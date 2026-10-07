# v0.4.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
from genlayer import *
import genlayer as gl
from genlayer.storage import allow as allow_storage
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
# ── v0.4.0 — AI JURY 2.0 ────────────────────────────────────────────────────
# The jury was upgraded from a single generic prompt over a single page into a
# MULTI-PERSPECTIVE PANEL backed by a LIVE WEB CROSS-CHECK:
#   • It reads the deliverable, then does a SECOND independent web read — a live
#     search for a distinctive phrase from the work — to detect plagiarism from
#     real external evidence instead of guessing from page chrome.
#   • One structured reasoning pass runs THREE auditor lenses (Forensic authorship,
#     Originality/plagiarism, Spec-compliance) and returns a per-lens breakdown
#     plus separate authenticity & originality scores — not just one number.
#   • Payment now requires FOUR gates to pass (verdict + confidence + spec-match +
#     authenticity + originality), and validator consensus checks EVERY gate, so
#     two validators who merely phrase things differently still agree while any
#     real disagreement on meaning or on the pay/no-pay decision blocks consensus.
#
# Consensus checks MEANING (the verdict + every pay gate), not JSON shape — see
# validator_fn.
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

# Cross-check outcome (stored u8): did the live web corroborate originality?
X_UNKNOWN = 0       # no external corroboration available (search failed/blocked)
X_CLEAN = 1         # the distinctive phrase was NOT found verbatim online
X_HIT = 2           # the distinctive phrase WAS found verbatim online (plagiarism signal)

# How much text of the deliverable we feed the model (keeps the prompt bounded).
_MAX_EVIDENCE_CHARS = 8000
# How much of the live search result page we feed the model for the cross-check.
_MAX_CROSSCHECK_CHARS = 3500


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


def _addr_str(addr) -> str:
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


def _clamp(value: int) -> int:
    return max(0, min(value, 100))


def _url_q(s: str) -> str:
    """Percent-encode a string for use in a URL query (stdlib-free so the
    genvm sandbox never has to whitelist urllib). Keeps unreserved chars."""
    safe = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~"
    out = []
    for ch in s:
        if ch in safe:
            out.append(ch)
        elif ch == " ":
            out.append("+")
        else:
            for byte in ch.encode("utf-8"):
                out.append("%" + format(byte, "02X"))
    return "".join(out)


_PHRASE_WORDS = 10  # short enough to match a search-result snippet verbatim


def _distinctive_phrase(text: str) -> str:
    """Pick a distinctive, quotable phrase from the deliverable for the web
    cross-check. Deterministic (every validator derives the SAME phrase from the
    SAME page): a clean run of words from the longest 'sentence-like' span,
    trimmed to ~10 words so an exact quoted search can match a result snippet.

    We strip citation/footnote brackets (e.g. "[1]") and skip spans that look
    like navigation/boilerplate so the search targets the real body text.
    """
    # Drop bracketed footnote markers that break verbatim matching.
    cleaned = []
    skip = False
    for ch in text:
        if ch == "[":
            skip = True
        elif ch == "]":
            skip = False
        elif not skip:
            cleaned.append(ch)
    flat = " ".join("".join(cleaned).split())
    # Split on sentence terminators without regex (keeps the runner happy).
    for ch in [". ", "! ", "? ", "。"]:
        flat = flat.replace(ch, "\n")
    candidates = [s.strip() for s in flat.split("\n")]
    best = ""
    for s in candidates:
        words = s.split(" ")
        if len(words) < 6:
            continue
        low = s.lower()
        if any(junk in low for junk in (
            "skip to", "cookie", "sign in", "subscribe", "menu", "copyright",
            "all rights reserved", "privacy policy", "terms of service", "edit",
        )):
            continue
        # Prefer the longest qualifying sentence; it is the most searchable.
        if len(words) > len(best.split(" ")):
            best = s
    if best == "":
        # Fallback: first words of the whole document.
        best = " ".join(flat.replace("\n", " ").split(" ")[:_PHRASE_WORDS])
    # Take a run from the MIDDLE of the sentence — less likely to be a generic opener.
    words = best.split(" ")
    if len(words) > _PHRASE_WORDS:
        start = (len(words) - _PHRASE_WORDS) // 2
        words = words[start:start + _PHRASE_WORDS]
    return " ".join(words).strip()


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
    authenticity: u8        # v0.4 forensic-lens score: human authorship (0-100)
    originality: u8         # v0.4 plagiarism-lens score: originality (0-100)
    cross_check: u8         # v0.4 live web cross-check outcome (X_UNKNOWN/CLEAN/HIT)
    panel: str              # v0.4 JSON array of the per-lens auditor findings
    reason: str
    appealed: bool


class Contract(gl.contract.Contract):
    # ── persistent storage ──────────────────────────────────────────────────
    bounties: gl.storage.TreeMap[str, Bounty]
    bounty_ids: gl.storage.DynArray[str]
    credits: gl.storage.TreeMap[str, bigint]        # pull-payment ledger: address -> withdrawable GEN

    # portable reputation, earned from real adjudicated outcomes
    rep_genuine: gl.storage.TreeMap[str, bigint]    # count of GENUINE verdicts per worker
    rep_fraud: gl.storage.TreeMap[str, bigint]      # count of fraud verdicts per worker
    rep_earned: gl.storage.TreeMap[str, bigint]     # total GEN earned per worker

    next_id: bigint
    confidence_threshold: u8             # min confidence to approve a GENUINE verdict
    min_spec_match: u8                   # min spec-match score to approve
    min_authenticity: u8                 # v0.4 min forensic authorship score to approve
    min_originality: u8                  # v0.4 min originality score to approve

    def __init__(self):
        # Only scalars here. TreeMap / DynArray fields auto-initialize to empty;
        # touching them in __init__ breaks on some Studio builds.
        self.next_id = bigint(0)
        self.confidence_threshold = u8(60)
        self.min_spec_match = u8(50)
        self.min_authenticity = u8(55)
        self.min_originality = u8(55)

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
            authenticity=u8(0),
            originality=u8(0),
            cross_check=u8(X_UNKNOWN),
            panel="",
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
        """Run the multi-perspective AI jury over the deliverable and settle
        (or open an appeal window)."""
        b = self._get(bounty_id)
        if b.status not in (u8(S_SUBMITTED), u8(S_APPEALED)):
            raise gl.vm.UserError("bounty is not awaiting review")

        # Read everything from storage BEFORE the non-deterministic block.
        # Nothing inside the block may touch contract storage.
        spec = b.spec
        rules = b.rules
        url = b.deliverable_url
        is_appeal = b.status == u8(S_APPEALED)
        conf_threshold = int(self.confidence_threshold)
        spec_threshold = int(self.min_spec_match)
        auth_threshold = int(self.min_authenticity)
        orig_threshold = int(self.min_originality)

        def _payment_approved(d: dict) -> bool:
            """Approve payment IF AND ONLY IF the verdict is GENUINE and ALL
            FOUR quality gates clear their thresholds. Adding the authenticity
            and originality gates (v0.4) means a slick, polished deliverable that
            the forensic lens still flags as machine-written, or that the
            originality lens / live cross-check flags as copied, is NOT paid even
            if it reads as 'on-spec'."""
            if not isinstance(d, dict):
                return False
            v = d.get("verdict")
            c = _clamp(_as_int(d.get("confidence", 0), 0))
            s = _clamp(_as_int(d.get("spec_match", 0), 0))
            a = _clamp(_as_int(d.get("authenticity", 0), 0))
            o = _clamp(_as_int(d.get("originality", 0), 0))
            return (
                v == V_GENUINE
                and c >= conf_threshold
                and s >= spec_threshold
                and a >= auth_threshold
                and o >= orig_threshold
            )

        def _pay_gates(d: dict) -> tuple:
            """The directional pass/fail of each gate — what validators must
            agree on (robust to small numeric wobble between models)."""
            if not isinstance(d, dict):
                return (False, False, False, False, False)
            v = d.get("verdict") == V_GENUINE
            c = _clamp(_as_int(d.get("confidence", 0), 0)) >= conf_threshold
            s = _clamp(_as_int(d.get("spec_match", 0), 0)) >= spec_threshold
            a = _clamp(_as_int(d.get("authenticity", 0), 0)) >= auth_threshold
            o = _clamp(_as_int(d.get("originality", 0), 0)) >= orig_threshold
            return (v, c, s, a, o)

        def _run_panel() -> dict:
            # 1) Read the deliverable itself.
            try:
                page = gl.nondet.web.render(url, mode="text")
            except Exception:
                page = ""
            if len(page.strip()) == 0:
                return {
                    "verdict": V_UNCLEAR,
                    "confidence": 90,
                    "spec_match": 0,
                    "authenticity": 0,
                    "originality": 0,
                    "cross_check": X_UNKNOWN,
                    "panel": [
                        {"lens": "Intake", "score": 0,
                         "finding": "The deliverable URL returned no readable content (dead link, empty, or blocked)."},
                    ],
                    "reason": "The deliverable URL returned no readable content (dead link, empty, or blocked).",
                    "payment_approved": False,
                }
            evidence = page[:_MAX_EVIDENCE_CHARS]

            # 2) LIVE WEB CROSS-CHECK — a SECOND, independent web read.
            #    Search the open web for a distinctive phrase from the work. If
            #    the exact phrase surfaces elsewhere, that is concrete external
            #    evidence of copying; if the search is blocked, we degrade to
            #    'no corroboration' rather than punishing the worker.
            phrase = _distinctive_phrase(evidence)
            cross_text = ""
            cross_check = X_UNKNOWN
            try:
                q = _url_q('"' + phrase + '"')
                search_url = "https://html.duckduckgo.com/html/?q=" + q
                cross_text = gl.nondet.web.render(search_url, mode="text")[:_MAX_CROSSCHECK_CHARS]
                if len(cross_text.strip()) > 0:
                    # A verbatim hit is a strong, machine-checkable plagiarism signal.
                    cross_check = X_HIT if phrase.lower() in cross_text.lower() else X_CLEAN
            except Exception:
                cross_text = ""
                cross_check = X_UNKNOWN

            cross_summary = {
                X_HIT: "A verbatim copy of a distinctive phrase from this deliverable was FOUND on the open web.",
                X_CLEAN: "No verbatim copy of a distinctive phrase from this deliverable was found on the open web.",
                X_UNKNOWN: "No external corroboration was available (the web search returned nothing).",
            }[cross_check]

            strictness = (
                "This is an APPEAL of a prior fraud ruling. Re-examine carefully and overturn "
                "to GENUINE if the earlier call was not backed by concrete evidence."
                if is_appeal
                else "This is the first review."
            )

            # 3) ONE structured reasoning pass over THREE auditor lenses.
            prompt = f"""You are a three-member authenticity PANEL adjudicating a paid work bounty.
{strictness}

Reason explicitly as THREE independent auditors, each with a narrow mandate, then
synthesise ONE verdict. Presume the work is GENUINE and only rule against it when a
panelist can cite CONCRETE evidence. A fair, honest worker must be paid; do not punish
competent writing merely for being polished.

PANEL MEMBERS:
  1. FORENSIC AUTHORSHIP — Was this written by a human doing real work, or machine-
     generated? Human hallmarks: specific lived detail, concrete named facts, a point
     of view, uneven but purposeful structure. AI hallmarks: hollow generic phrasing,
     fabricated or self-contradictory specifics, uniform padding, lists that say nothing.
     Score authenticity 0-100 (100 = unmistakably human).
  2. ORIGINALITY / PLAGIARISM — Is this the worker's own text or copied? Use the LIVE
     WEB CROSS-CHECK result below as evidence. Verbatim passages, embedded site chrome
     (e.g. "Skip to main content", cookie banners, doc-site navigation), or a confirmed
     web match mean PLAGIARIZED. Score originality 0-100 (100 = fully original).
  3. SPEC-COMPLIANCE — Independently of authenticity, does it satisfy what was asked?
     Genuine work can still be off-spec. Score spec_match 0-100.

BOUNTY SPEC (what the worker was asked to deliver):
{spec}

RULES THE WORKER MUST FOLLOW:
{rules if len(rules.strip()) > 0 else "(no extra rules beyond producing genuine, original, on-spec work)"}

LIVE WEB CROSS-CHECK:
Distinctive phrase searched: "{phrase}"
Result: {cross_summary}
Raw search excerpt (may be empty):
\"\"\"
{cross_text}
\"\"\"

SUBMITTED DELIVERABLE — text extracted from {url}:
\"\"\"
{evidence}
\"\"\"

Final verdict (exactly one):
  • PLAGIARIZED — copied from an external source (verbatim passages, embedded site
    chrome, or a confirmed web cross-check hit).
  • AI_GENERATED — concrete hallmarks of machine generation. Polish alone is NOT evidence.
  • GENUINE — on-topic AND authentic authorship: specific, concrete, first-hand or
    reasoned detail a real person would actually write.
  • UNCLEAR — content is empty/unreadable or you truly cannot decide.

Reply with ONLY a JSON object, no prose:
{{"verdict": "GENUINE" | "AI_GENERATED" | "PLAGIARIZED" | "UNCLEAR",
  "confidence": <integer 0-100, how sure you are of the verdict>,
  "spec_match": <integer 0-100>,
  "authenticity": <integer 0-100 from the Forensic Authorship lens>,
  "originality": <integer 0-100 from the Originality/Plagiarism lens>,
  "panel": [
     {{"lens": "Forensic Authorship", "score": <0-100>, "finding": "<one sentence citing concrete evidence>"}},
     {{"lens": "Originality", "score": <0-100>, "finding": "<one sentence; reference the web cross-check>"}},
     {{"lens": "Spec Compliance", "score": <0-100>, "finding": "<one sentence>"}}
  ],
  "reason": "<two-sentence synthesis citing the strongest concrete evidence>"}}"""
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(res, dict):
                res = {
                    "verdict": V_UNCLEAR,
                    "confidence": 0,
                    "spec_match": 0,
                    "authenticity": 0,
                    "originality": 0,
                    "panel": [],
                    "reason": "Invalid response format from validator model.",
                }
            # Attach the deterministic cross-check outcome and the pay decision.
            res["cross_check"] = cross_check
            # Safety net: a confirmed verbatim web hit floors originality so a
            # model that under-weights the cross-check still can't pay a copy.
            if cross_check == X_HIT:
                res["originality"] = min(_clamp(_as_int(res.get("originality", 0), 0)), 20)
            res["payment_approved"] = _payment_approved(res)
            return res

        def leader_fn():
            return _run_panel()

        def validator_fn(res) -> bool:
            # Leader must have returned successfully.
            if not isinstance(res, gl.vm.Return):
                return False
            leader = res.calldata
            if not isinstance(leader, dict):
                return False
            mine = _run_panel()
            if not isinstance(mine, dict):
                return False

            # Validators must agree on the MEANING of the judgment:
            #   1. the verdict category, and
            #   2. the full pay/no-pay decision — EVERY gate (verdict, confidence,
            #      spec-match, authenticity, originality) must land on the same
            #      side of its threshold.
            # They do NOT need identical numbers or identical wording — only the
            # same directional outcome on each gate. This is what lets two honest
            # models agree while any real disagreement on meaning blocks consensus.
            verdict_match = mine.get("verdict") == leader.get("verdict")
            gates_match = _pay_gates(mine) == _pay_gates(leader)
            return verdict_match and gates_match

        # gl.vm.run_nondet is the recommended API (sandboxes validator errors).
        result = gl.vm.run_nondet(leader_fn, validator_fn)

        if not isinstance(result, dict):
            result = {}

        verdict = result.get("verdict", V_UNCLEAR)
        confidence = _clamp(_as_int(result.get("confidence", 0), 0))
        spec_match = _clamp(_as_int(result.get("spec_match", 0), 0))
        authenticity = _clamp(_as_int(result.get("authenticity", 0), 0))
        originality = _clamp(_as_int(result.get("originality", 0), 0))
        cross_check = _as_int(result.get("cross_check", X_UNKNOWN), X_UNKNOWN)
        if cross_check not in (X_UNKNOWN, X_CLEAN, X_HIT):
            cross_check = X_UNKNOWN
        reason = str(result.get("reason", ""))[:1000]
        panel_val = result.get("panel", [])
        try:
            panel_json = json.dumps(panel_val)[:2000]
        except Exception:
            panel_json = "[]"

        b.verdict = verdict
        b.confidence = u8(confidence)
        b.spec_match = u8(spec_match)
        b.authenticity = u8(authenticity)
        b.originality = u8(originality)
        b.cross_check = u8(cross_check)
        b.panel = panel_json
        b.reason = reason

        approve = _payment_approved(result)

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
        _Recipient(gl.Address(addr)).emit_transfer(value=u256(amount))

    # ── views ─────────────────────────────────────────────────────────────────
    def _get(self, bounty_id: str) -> Bounty:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError("bounty not found")
        return self.bounties[bounty_id]

    def _to_dict(self, b: Bounty) -> dict:
        try:
            panel = json.loads(b.panel) if b.panel else []
        except Exception:
            panel = []
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
            "authenticity": int(b.authenticity),
            "originality": int(b.originality),
            "cross_check": int(b.cross_check),
            "panel": panel,
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
            "min_authenticity": int(self.min_authenticity),
            "min_originality": int(self.min_originality),
            "total_bounties": int(self.next_id),
        })
