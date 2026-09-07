# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
from dataclasses import dataclass

# ─────────────────────────────────────────────────────────────────────────────
# Proof of Sweat — an Intelligent Contract for the GenLayer "Agent Tank" hackathon
# Track: Future of Work
#
# A bounty escrow where a worker is paid ONLY if GenLayer's validator network,
# each running a different LLM, reaches subjective consensus that the submitted
# deliverable is GENUINE human/allowed effort — not AI-generated slop, plagiarism,
# or off-spec filler. The judgment is produced on-chain by reading the live
# deliverable URL and reasoning over it. This is impossible in plain Solidity:
# it needs (1) direct web reading with no oracle and (2) subjective judgment that
# converges across independent, diverse models.
#
# Consensus checks MEANING (the verdict), not JSON shape — see validator_fn.
# ─────────────────────────────────────────────────────────────────────────────

# Verdict categories returned by the AI jury.
V_GENUINE = "GENUINE"
V_AI = "AI_GENERATED"
V_PLAGIARIZED = "PLAGIARIZED"
V_UNCLEAR = "UNCLEAR"

# Bounty lifecycle (stored as u8 to satisfy GenLayer storage rules — no bare int).
S_OPEN = 0          # created + funded by client, no worker yet
S_CLAIMED = 1       # worker staked and locked the bounty
S_SUBMITTED = 2     # worker submitted a deliverable URL, awaiting adjudication
S_APPROVED = 3      # AI jury ruled GENUINE — worker paid (terminal)
S_REJECTED = 4      # AI jury ruled fraud/unclear — appeal window open
S_APPEALED = 5      # worker staked an appeal bond, awaiting re-adjudication
S_RESOLVED_FRAUD = 6  # fraud upheld / client finalized — client compensated (terminal)
S_CANCELLED = 7     # client cancelled an unclaimed bounty (terminal)

# How much text of the deliverable we feed the model (keeps the prompt bounded).
_MAX_EVIDENCE_CHARS = 8000


@gl.evm.contract_interface
class _Recipient:
    # Sending native GEN to an EOA on the chain layer is an "external message"
    # routed through the IC's ghost contract. Per GenLayer docs this uses the EVM
    # contract interface even though the recipient is a plain address, and value
    # transfers to EOAs are the one EVM interaction Studio does support.
    class View:
        pass

    class Write:
        pass


def _addr_str(addr: Address) -> str:
    """Convert an Address to a stable hex string, defensively across builds."""
    try:
        return addr.as_hex
    except Exception:
        return str(addr)


def _as_int(value, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


@allow_storage
@dataclass
class Bounty:
    id: str
    client: str
    worker: str
    title: str
    spec: str
    rules: str
    reward: bigint          # escrowed native GEN (wei), funded by the client
    stake_required: bigint  # worker must match this to claim (anti-spam skin-in-game)
    worker_stake: bigint    # what the worker actually locked (stake + any appeal bond)
    deliverable_url: str
    status: u8
    verdict: str
    confidence: u8
    spec_match: u8
    reason: str
    appealed: bool


class Contract(gl.Contract):
    # ── persistent storage ──────────────────────────────────────────────────
    bounties: TreeMap[str, Bounty]
    bounty_ids: DynArray[str]
    credits: TreeMap[str, bigint]        # pull-payment ledger: address -> withdrawable GEN

    # portable reputation, earned from real adjudicated outcomes
    rep_genuine: TreeMap[str, bigint]    # count of GENUINE verdicts per worker
    rep_fraud: TreeMap[str, bigint]      # count of fraud verdicts per worker
    rep_earned: TreeMap[str, bigint]     # total GEN earned per worker

    next_id: bigint
    confidence_threshold: u8             # min confidence to approve a GENUINE verdict
    min_spec_match: u8                   # min spec-match score to approve

    def __init__(self):
        # Only scalars here. TreeMap / DynArray fields auto-initialize to empty;
        # touching them in __init__ breaks on some Studio builds.
        self.next_id = bigint(0)
        self.confidence_threshold = u8(60)
        self.min_spec_match = u8(50)

    # ── internal helpers ─────────────────────────────────────────────────────
    def _credit(self, addr: str, amount: bigint) -> None:
        current = self.credits[addr] if addr in self.credits else bigint(0)
        self.credits[addr] = current + amount

    def _bump_rep_genuine(self, worker: str, earned: bigint) -> None:
        g = self.rep_genuine[worker] if worker in self.rep_genuine else bigint(0)
        self.rep_genuine[worker] = g + bigint(1)
        e = self.rep_earned[worker] if worker in self.rep_earned else bigint(0)
        self.rep_earned[worker] = e + earned

    def _bump_rep_fraud(self, worker: str) -> None:
        f = self.rep_fraud[worker] if worker in self.rep_fraud else bigint(0)
        self.rep_fraud[worker] = f + bigint(1)

    # ── writes ───────────────────────────────────────────────────────────────
    @gl.public.write.payable
    def create_bounty(self, title: str, spec: str, rules: str, stake_required: int) -> str:
        reward = gl.message.value
        if reward <= 0:
            raise gl.vm.UserError("bounty reward must be > 0 (send native GEN)")
        if stake_required < 0:
            raise gl.vm.UserError("stake_required cannot be negative")
        if len(title.strip()) == 0:
            raise gl.vm.UserError("title required")
        if len(spec.strip()) == 0:
            raise gl.vm.UserError("spec required")

        bid = str(self.next_id)
        self.next_id = self.next_id + bigint(1)
        client = _addr_str(gl.message.sender_address)

        self.bounties[bid] = Bounty(
            id=bid,
            client=client,
            worker="",
            title=title,
            spec=spec,
            rules=rules,
            reward=bigint(reward),
            stake_required=bigint(stake_required),
            worker_stake=bigint(0),
            deliverable_url="",
            status=u8(S_OPEN),
            verdict="",
            confidence=u8(0),
            spec_match=u8(0),
            reason="",
            appealed=False,
        )
        self.bounty_ids.append(bid)
        return bid

    @gl.public.write
    def cancel_bounty(self, bounty_id: str) -> None:
        b = self._get(bounty_id)
        caller = _addr_str(gl.message.sender_address)
        if caller != b.client:
            raise gl.vm.UserError("only the client can cancel")
        if b.status != u8(S_OPEN):
            raise gl.vm.UserError("only an unclaimed bounty can be cancelled")
        b.status = u8(S_CANCELLED)
        self._credit(b.client, b.reward)

    @gl.public.write.payable
    def claim_bounty(self, bounty_id: str) -> None:
        b = self._get(bounty_id)
        if b.status != u8(S_OPEN):
            raise gl.vm.UserError("bounty is not open for claiming")
        if gl.message.value != b.stake_required:
            raise gl.vm.UserError("must send exactly the required stake")
        worker = _addr_str(gl.message.sender_address)
        if worker == b.client:
            raise gl.vm.UserError("client cannot claim their own bounty")
        b.worker = worker
        b.worker_stake = bigint(gl.message.value)
        b.status = u8(S_CLAIMED)

    @gl.public.write
    def submit_work(self, bounty_id: str, deliverable_url: str) -> None:
        b = self._get(bounty_id)
        caller = _addr_str(gl.message.sender_address)
        if caller != b.worker:
            raise gl.vm.UserError("only the assigned worker can submit")
        if b.status not in (u8(S_CLAIMED), u8(S_REJECTED)):
            raise gl.vm.UserError("bounty is not awaiting a submission")
        url = deliverable_url.strip()
        if len(url) == 0 or not (url.startswith("http://") or url.startswith("https://")):
            raise gl.vm.UserError("deliverable_url must be a valid http(s) URL")
        b.deliverable_url = url
        b.status = u8(S_SUBMITTED)

    @gl.public.write
    def adjudicate(self, bounty_id: str) -> str:
        """Run the AI jury over the deliverable and settle (or open an appeal window)."""
        b = self._get(bounty_id)
        if b.status not in (u8(S_SUBMITTED), u8(S_APPEALED)):
            raise gl.vm.UserError("bounty is not awaiting review")

        # Read everything from storage BEFORE the non-deterministic block.
        # Nothing inside the block may touch contract storage.
        spec = b.spec
        rules = b.rules
        url = b.deliverable_url
        is_appeal = b.status == u8(S_APPEALED)

        def leader_fn():
            try:
                page = gl.nondet.web.render(url, mode="text")
            except Exception:
                page = ""
            if len(page.strip()) == 0:
                return {
                    "verdict": V_UNCLEAR,
                    "confidence": 90,
                    "spec_match": 0,
                    "reason": "The deliverable URL returned no readable content (dead link, empty, or blocked).",
                }
            evidence = page[:_MAX_EVIDENCE_CHARS]
            strictness = (
                "This is an APPEAL of a prior fraud ruling. Re-examine carefully and overturn "
                "to GENUINE if the earlier call was not backed by concrete evidence."
                if is_appeal
                else "This is the first review."
            )
            prompt = f"""You are an impartial work-authenticity auditor for a paid bounty.
{strictness}

Presume the work is GENUINE. Only rule against it when you can point to CONCRETE evidence.
A fair, honest worker must be paid; do not punish competent writing for merely being polished.

BOUNTY SPEC (what the worker was asked to deliver):
{spec}

RULES THE WORKER MUST FOLLOW:
{rules if len(rules.strip()) > 0 else "(no extra rules beyond producing genuine, original, on-spec work)"}

SUBMITTED DELIVERABLE — text extracted from {url}:
\"\"\"
{evidence}
\"\"\"

Choose exactly one verdict:
  • PLAGIARIZED — only if the text is clearly copied from an external published source:
    verbatim passages, embedded site navigation/boilerplate (e.g. "Skip to main content",
    cookie banners, doc-site chrome), or an unmistakable match to known published material.
  • AI_GENERATED — only with concrete hallmarks of machine generation: hollow generic
    phrasing with no specific lived detail, fabricated or self-contradictory specifics,
    uniform boilerplate, or padded lists that say nothing. Polish alone is NOT evidence.
  • GENUINE — the deliverable is on-topic for the spec AND shows authentic authorship:
    specific, concrete, first-hand or reasoned detail a real person would actually write.
  • UNCLEAR — only if the content is empty/unreadable or you truly cannot decide.

Judge spec match separately: genuine work can still be off-spec.

Reply with ONLY a JSON object, no prose:
{{"verdict": "GENUINE" | "AI_GENERATED" | "PLAGIARIZED" | "UNCLEAR",
  "confidence": <integer 0-100, how sure you are of the verdict>,
  "spec_match": <integer 0-100, how well it satisfies the spec>,
  "reason": "<two sentences citing concrete evidence from the deliverable>"}}"""
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(res) -> bool:
            # Leader must have returned successfully.
            if not isinstance(res, gl.vm.Return):
                return False
            leader = res.calldata
            if not isinstance(leader, dict):
                return False
            mine = leader_fn()
            if not isinstance(mine, dict):
                return False
            # Consensus is on MEANING: agree iff the verdict category matches.
            # Free-text `reason` and small confidence drift are deliberately ignored —
            # two honest validators must never disagree just because they phrased
            # their reasoning differently.
            return mine.get("verdict") == leader.get("verdict")

        # gl.vm.run_nondet is the recommended API (sandboxes validator errors).
        # NOTE for deploy: if this Studio build raises AttributeError on run_nondet,
        # change it to gl.vm.run_nondet_unsafe (same call shape) — a runtime limit,
        # not a design choice. This is documented in the README.
        result = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = result.get("verdict", V_UNCLEAR) if isinstance(result, dict) else V_UNCLEAR
        confidence = _as_int(result.get("confidence", 0) if isinstance(result, dict) else 0, 0)
        spec_match = _as_int(result.get("spec_match", 0) if isinstance(result, dict) else 0, 0)
        reason = str(result.get("reason", "") if isinstance(result, dict) else "")[:1000]

        confidence = max(0, min(confidence, 100))
        spec_match = max(0, min(spec_match, 100))

        b.verdict = verdict
        b.confidence = u8(confidence)
        b.spec_match = u8(spec_match)
        b.reason = reason

        approve = (
            verdict == V_GENUINE
            and confidence >= int(self.confidence_threshold)
            and spec_match >= int(self.min_spec_match)
        )

        if approve:
            b.status = u8(S_APPROVED)
            payout = b.reward + b.worker_stake  # reward + own stake returned
            self._credit(b.worker, payout)
            self._bump_rep_genuine(b.worker, b.reward)
        else:
            if is_appeal:
                # Fraud upheld on appeal: client is compensated with everything the
                # worker locked (original stake + appeal bond) plus their reward back.
                b.status = u8(S_RESOLVED_FRAUD)
                self._credit(b.client, b.reward + b.worker_stake)
                self._bump_rep_fraud(b.worker)
            else:
                # First-pass fraud/unclear: open the appeal window. Funds stay escrowed.
                b.status = u8(S_REJECTED)

        return verdict

    @gl.public.write.payable
    def appeal(self, bounty_id: str) -> None:
        b = self._get(bounty_id)
        caller = _addr_str(gl.message.sender_address)
        if caller != b.worker:
            raise gl.vm.UserError("only the worker can appeal")
        if b.status != u8(S_REJECTED):
            raise gl.vm.UserError("only a rejected bounty can be appealed")
        if b.appealed:
            raise gl.vm.UserError("this bounty has already been appealed once")
        if gl.message.value < b.stake_required:
            raise gl.vm.UserError("appeal bond must be at least the original stake")
        b.worker_stake = b.worker_stake + bigint(gl.message.value)
        b.appealed = True
        b.status = u8(S_APPEALED)

    @gl.public.write
    def finalize_rejection(self, bounty_id: str) -> None:
        """Client claims escrow after a rejection the worker chose not to appeal."""
        b = self._get(bounty_id)
        caller = _addr_str(gl.message.sender_address)
        if caller != b.client:
            raise gl.vm.UserError("only the client can finalize")
        if b.status != u8(S_REJECTED):
            raise gl.vm.UserError("bounty is not in a finalizable rejected state")
        b.status = u8(S_RESOLVED_FRAUD)
        self._credit(b.client, b.reward + b.worker_stake)
        self._bump_rep_fraud(b.worker)

    @gl.public.write
    def withdraw(self) -> None:
        recipient = gl.message.sender_address
        addr = _addr_str(recipient)
        amount = self.credits[addr] if addr in self.credits else bigint(0)
        if amount <= 0:
            raise gl.vm.UserError("nothing to withdraw")
        # Pull-payment: zero the balance before transferring (reentrancy-safe).
        self.credits[addr] = bigint(0)
        # Native GEN transfer to the caller's EOA via the chain-layer external message.
        _Recipient(Address(addr)).emit_transfer(value=u256(amount))

    # ── views ─────────────────────────────────────────────────────────────────
    def _get(self, bounty_id: str) -> Bounty:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError("bounty not found")
        return self.bounties[bounty_id]

    def _to_dict(self, b: Bounty) -> dict:
        return {
            "id": b.id,
            "client": b.client,
            "worker": b.worker,
            "title": b.title,
            "spec": b.spec,
            "rules": b.rules,
            "reward": str(b.reward),
            "stake_required": str(b.stake_required),
            "worker_stake": str(b.worker_stake),
            "deliverable_url": b.deliverable_url,
            "status": int(b.status),
            "verdict": b.verdict,
            "confidence": int(b.confidence),
            "spec_match": int(b.spec_match),
            "reason": b.reason,
            "appealed": b.appealed,
        }

    @gl.public.view
    def get_bounty(self, bounty_id: str) -> str:
        return json.dumps(self._to_dict(self._get(bounty_id)))

    @gl.public.view
    def get_all_bounties(self) -> str:
        out = []
        for bid in self.bounty_ids:
            if bid in self.bounties:
                out.append(self._to_dict(self.bounties[bid]))
        return json.dumps(out)

    @gl.public.view
    def get_reputation(self, address: str) -> str:
        genuine = int(self.rep_genuine[address]) if address in self.rep_genuine else 0
        fraud = int(self.rep_fraud[address]) if address in self.rep_fraud else 0
        earned = str(self.rep_earned[address]) if address in self.rep_earned else "0"
        total = genuine + fraud
        score = int((genuine * 100) / total) if total > 0 else 0
        return json.dumps({
            "address": address,
            "genuine": genuine,
            "fraud": fraud,
            "earned": earned,
            "trust_score": score,
        })

    @gl.public.view
    def get_credit(self, address: str) -> str:
        amount = self.credits[address] if address in self.credits else bigint(0)
        return str(amount)

    @gl.public.view
    def get_config(self) -> str:
        return json.dumps({
            "confidence_threshold": int(self.confidence_threshold),
            "min_spec_match": int(self.min_spec_match),
            "total_bounties": int(self.next_id),
        })
