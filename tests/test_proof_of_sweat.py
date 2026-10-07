"""Direct-mode tests for Proof of Sweat.

These run the contract in-memory (no network / Docker) via genlayer-test's
direct fixtures, mocking the web reads and the LLM jury. They cover the happy
path, every edge case with a UserError, the appeal flow, and — most importantly —
that the validator DISAGREES when two validators reach different verdicts OR a
different pay/no-pay decision (the core GenLayer consensus guarantee this project
is built on).

v0.4 "AI Jury 2.0" adds coverage for the upgraded jury:
  • the multi-perspective panel is recorded on-chain,
  • the live web cross-check blocks payment on a verbatim plagiarism hit,
  • the new authenticity gate blocks polished-but-machine-written work, and
  • consensus still holds across every pay gate.

    pip install "genlayer-test[sim]"
    pytest tests/ -v
"""
import json

CONTRACT = "contracts/proof_of_sweat.py"

REWARD = 1_000
STAKE = 100
URL = "https://example.com/deliverable"

# Search-engine result bodies for the live cross-check (second web read).
CLEAN_SEARCH = "No results found. Your search did not match any documents."

# v0.4 verdicts now carry authenticity + originality sub-scores and a panel.
GENUINE = json.dumps({
    "verdict": "GENUINE", "confidence": 90, "spec_match": 85,
    "authenticity": 88, "originality": 90,
    "panel": [
        {"lens": "Forensic Authorship", "score": 88, "finding": "Specific lived detail; clearly human."},
        {"lens": "Originality", "score": 90, "finding": "No web match; original wording."},
        {"lens": "Spec Compliance", "score": 85, "finding": "Covers what was asked."},
    ],
    "reason": "Original, on-spec work with concrete, verifiable detail.",
})
LOW_CONF_GENUINE = json.dumps({
    "verdict": "GENUINE", "confidence": 40, "spec_match": 80,
    "authenticity": 80, "originality": 80,
    "reason": "Plausibly genuine but hard to be sure.",
})
SLICK_AI_AS_GENUINE = json.dumps({
    # A model that calls it GENUINE but the forensic lens still scores low:
    # the authenticity gate must stop payment.
    "verdict": "GENUINE", "confidence": 85, "spec_match": 85,
    "authenticity": 30, "originality": 80,
    "reason": "Reads on-spec but forensic signal of machine authorship is high.",
})
COPIED_AS_GENUINE = json.dumps({
    # A model that calls it GENUINE with high originality, but the deterministic
    # web cross-check finds a verbatim copy — originality is floored, payment blocked.
    "verdict": "GENUINE", "confidence": 85, "spec_match": 85,
    "authenticity": 85, "originality": 85,
    "reason": "Looks original to the model, but a verbatim copy exists online.",
})
AI_SLOP = json.dumps({
    "verdict": "AI_GENERATED", "confidence": 88, "spec_match": 20,
    "authenticity": 15, "originality": 60,
    "reason": "Generic phrasing and hollow structure typical of AI generation.",
})


def _mock_ok(vm, llm_response=GENUINE, body="Real, specific deliverable content.",
             search_body=CLEAN_SEARCH):
    # The cross-check hits a search engine; register it FIRST so the catch-all
    # deliverable mock below does not shadow it (first match wins).
    vm.mock_web(r".*duckduckgo.*", {"status": 200, "body": search_body})
    vm.mock_web(r".*", {"status": 200, "body": body})
    vm.mock_llm(r".*", llm_response)


def _new_bounty(vm, deploy, client, *, reward=REWARD, stake=STAKE):
    c = deploy(CONTRACT)
    vm.sender = client
    vm.value = reward
    bid = c.create_bounty("Write docs", "Document the API", "No AI-generated content.", stake)
    vm.value = 0
    return c, bid


def _bounty(c, bid):
    return json.loads(c.get_bounty(bid))


# ── creation ─────────────────────────────────────────────────────────────────
def test_create_bounty_escrows_reward(direct_vm, direct_deploy, direct_alice):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    b = _bounty(c, bid)
    assert b["status"] == 0  # OPEN
    assert b["reward"] == str(REWARD)
    assert b["stake_required"] == str(STAKE)
    assert b["worker"] == ""


def test_create_bounty_zero_reward_reverts(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("reward must be > 0"):
        c.create_bounty("t", "spec", "rules", STAKE)


def test_create_bounty_empty_spec_reverts(direct_vm, direct_deploy, direct_alice):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = REWARD
    with direct_vm.expect_revert("spec required"):
        c.create_bounty("title", "   ", "rules", STAKE)


# ── claiming ─────────────────────────────────────────────────────────────────
def test_claim_wrong_stake_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = STAKE + 1
    with direct_vm.expect_revert("exactly the required stake"):
        c.claim_bounty(bid)


def test_client_cannot_claim_own(direct_vm, direct_deploy, direct_alice):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = STAKE
    with direct_vm.expect_revert("cannot claim their own"):
        c.claim_bounty(bid)


def test_claim_sets_worker(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = STAKE
    c.claim_bounty(bid)
    direct_vm.value = 0
    b = _bounty(c, bid)
    assert b["status"] == 1  # CLAIMED
    assert b["worker"] != ""


# ── submission ───────────────────────────────────────────────────────────────
def _claim(c, vm, bid, worker):
    vm.sender = worker
    vm.value = STAKE
    c.claim_bounty(bid)
    vm.value = 0


def test_submit_bad_url_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _claim(c, direct_vm, bid, direct_bob)
    with direct_vm.expect_revert("valid http"):
        c.submit_work(bid, "not-a-url")


def test_submit_non_worker_reverts(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _claim(c, direct_vm, bid, direct_bob)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("only the assigned worker"):
        c.submit_work(bid, URL)


# ── adjudication: happy path ─────────────────────────────────────────────────
def _submit(c, vm, bid, worker):
    _claim(c, vm, bid, worker)
    vm.sender = worker
    c.submit_work(bid, URL)


def test_genuine_verdict_pays_worker(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, GENUINE)
    verdict = c.adjudicate(bid)
    assert verdict == "GENUINE"
    b = _bounty(c, bid)
    assert b["status"] == 3  # APPROVED
    worker = b["worker"]
    # worker credited reward + returned stake
    assert c.get_credit(worker) == str(REWARD + STAKE)
    rep = json.loads(c.get_reputation(worker))
    assert rep["genuine"] == 1 and rep["trust_score"] == 100


def test_ai_slop_verdict_rejects(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, AI_SLOP)
    verdict = c.adjudicate(bid)
    assert verdict == "AI_GENERATED"
    b = _bounty(c, bid)
    assert b["status"] == 4  # REJECTED (appeal window open)


def test_low_confidence_genuine_does_not_pay(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, LOW_CONF_GENUINE)
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert b["status"] == 4  # REJECTED — confidence below threshold, not auto-approved


def test_low_authenticity_genuine_does_not_pay(direct_vm, direct_deploy, direct_alice, direct_bob):
    """v0.4 gate: a deliverable the model labels GENUINE but the FORENSIC lens
    scores low on authenticity must NOT be paid — polish is not proof of human work."""
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, SLICK_AI_AS_GENUINE)
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert b["verdict"] == "GENUINE"      # model said genuine…
    assert b["authenticity"] == 30         # …but forensic score is low
    assert b["status"] == 4                # …so payment is blocked (REJECTED)


def test_web_crosscheck_hit_blocks_payment(direct_vm, direct_deploy, direct_alice, direct_bob):
    """v0.4 live cross-check: if a distinctive phrase from the deliverable is
    found VERBATIM on the open web, originality is floored and payment is blocked
    even when the model itself reported high originality."""
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    body = ("The quarterly migration runbook moves every tenant shard to the new "
            "region without downtime using a dual-write cutover.")
    # The search engine returns the SAME distinctive sentence → verbatim hit.
    _mock_ok(direct_vm, COPIED_AS_GENUINE, body=body, search_body=body)
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert b["cross_check"] == 2           # X_HIT
    assert b["originality"] <= 20          # floored by the cross-check
    assert b["status"] == 4                # payment blocked


def test_panel_is_recorded(direct_vm, direct_deploy, direct_alice, direct_bob):
    """The per-lens auditor panel is stored on-chain and returned to the UI."""
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, GENUINE)
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert isinstance(b["panel"], list) and len(b["panel"]) == 3
    assert b["panel"][0]["lens"] == "Forensic Authorship"
    assert b["authenticity"] == 88 and b["originality"] == 90
    assert b["cross_check"] == 1           # X_CLEAN (no web match)


def test_dead_link_is_unclear(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    # empty body → leader returns UNCLEAR without even needing the LLM
    direct_vm.mock_web(r".*", {"status": 200, "body": ""})
    direct_vm.mock_llm(r".*", GENUINE)
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert b["verdict"] == "UNCLEAR"
    assert b["status"] == 4  # REJECTED


# ── the consensus guarantee (the whole point) ────────────────────────────────
def test_validators_agree_on_same_verdict(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, GENUINE)
    c.adjudicate(bid)  # leader ran; validator captured
    # a second validator that also sees GENUINE agrees
    assert direct_vm.run_validator() is True


def test_validators_disagree_on_different_verdict(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Two validators reaching DIFFERENT verdicts must NOT reach consensus.
    This is the line between a real GenLayer contract and a fake one."""
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, GENUINE)
    c.adjudicate(bid)  # leader said GENUINE
    # swap the LLM so the validator now sees AI_GENERATED — it must disagree
    direct_vm.clear_mocks()
    _mock_ok(direct_vm, AI_SLOP)
    assert direct_vm.run_validator() is False


def test_validator_rejects_reason_only_difference(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Same verdict, different free-text reason → validators STILL agree.
    Consensus is on meaning, not wording."""
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, GENUINE)
    c.adjudicate(bid)
    direct_vm.clear_mocks()
    other_wording = json.dumps({"verdict": "GENUINE", "confidence": 77, "spec_match": 70,
                                "authenticity": 80, "originality": 80,
                                "reason": "Completely different sentence, same conclusion."})
    _mock_ok(direct_vm, other_wording)
    assert direct_vm.run_validator() is True


def test_validators_disagree_when_payment_decision_differs(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Leader sees GENUINE above threshold (pays).
    Validator sees GENUINE below confidence threshold (does NOT pay).
    Even though both rule GENUINE, they MUST DISAGREE because their payment
    decisions differ (confidence threshold not met by validator)."""
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, GENUINE)  # conf=90, spec=85 -> pays
    c.adjudicate(bid)
    direct_vm.clear_mocks()
    _mock_ok(direct_vm, LOW_CONF_GENUINE)  # conf=40 (< 60) -> does not pay
    assert direct_vm.run_validator() is False


def test_validators_disagree_when_authenticity_gate_differs(direct_vm, direct_deploy, direct_alice, direct_bob):
    """v0.4: both rule GENUINE, but one clears the authenticity gate and the
    other does not → no consensus. Proves the new gate is part of the agreement."""
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, GENUINE)  # authenticity=88 -> pays
    c.adjudicate(bid)
    direct_vm.clear_mocks()
    _mock_ok(direct_vm, SLICK_AI_AS_GENUINE)  # authenticity=30 (< 55) -> does not pay
    assert direct_vm.run_validator() is False


# ── appeal flow ──────────────────────────────────────────────────────────────
def test_appeal_overturns_and_pays(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, AI_SLOP)
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert b["status"] == 4  # REJECTED
    worker = b["worker"]
    # worker appeals with a bond
    direct_vm.sender = direct_bob
    direct_vm.value = STAKE
    c.appeal(bid)
    direct_vm.value = 0
    assert _bounty(c, bid)["status"] == 5  # APPEALED
    # re-adjudication now sees genuine work
    direct_vm.clear_mocks()
    _mock_ok(direct_vm, GENUINE)
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert b["status"] == 3  # APPROVED
    # worker gets reward + original stake + appeal bond
    assert c.get_credit(worker) == str(REWARD + STAKE + STAKE)


def test_appeal_upheld_pays_client(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, AI_SLOP)
    c.adjudicate(bid)
    client = _bounty(c, bid)["client"]
    direct_vm.sender = direct_bob
    direct_vm.value = STAKE
    c.appeal(bid)
    direct_vm.value = 0
    # fraud upheld on appeal
    c.adjudicate(bid)
    b = _bounty(c, bid)
    assert b["status"] == 6  # RESOLVED_FRAUD
    # client compensated with reward + worker stake + appeal bond
    assert c.get_credit(client) == str(REWARD + STAKE + STAKE)
    rep = json.loads(c.get_reputation(b["worker"]))
    assert rep["fraud"] == 1


def test_appeal_requires_min_bond(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, AI_SLOP)
    c.adjudicate(bid)
    direct_vm.sender = direct_bob
    direct_vm.value = STAKE - 1
    with direct_vm.expect_revert("appeal bond must be at least"):
        c.appeal(bid)


# ── client finalize + cancel ─────────────────────────────────────────────────
def test_finalize_rejection_pays_client(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _submit(c, direct_vm, bid, direct_bob)
    _mock_ok(direct_vm, AI_SLOP)
    c.adjudicate(bid)
    client = _bounty(c, bid)["client"]
    direct_vm.sender = direct_alice
    c.finalize_rejection(bid)
    b = _bounty(c, bid)
    assert b["status"] == 6  # RESOLVED_FRAUD
    assert c.get_credit(client) == str(REWARD + STAKE)


def test_cancel_open_bounty_refunds(direct_vm, direct_deploy, direct_alice):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    c.cancel_bounty(bid)
    b = _bounty(c, bid)
    assert b["status"] == 7  # CANCELLED
    assert c.get_credit(b["client"]) == str(REWARD)


def test_cannot_cancel_claimed(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _new_bounty(direct_vm, direct_deploy, direct_alice)
    _claim(c, direct_vm, bid, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unclaimed bounty"):
        c.cancel_bounty(bid)


# ── listing + config ─────────────────────────────────────────────────────────
def test_get_all_bounties(direct_vm, direct_deploy, direct_alice):
    c, _ = _new_bounty(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = REWARD
    c.create_bounty("Second", "Another spec", "", STAKE)
    direct_vm.value = 0
    allb = json.loads(c.get_all_bounties())
    assert len(allb) == 2


def test_config_exposes_new_gates(direct_vm, direct_deploy, direct_alice):
    c, _ = _new_bounty(direct_vm, direct_deploy, direct_alice)
    cfg = json.loads(c.get_config())
    assert cfg["min_authenticity"] == 55
    assert cfg["min_originality"] == 55
    assert cfg["confidence_threshold"] == 60
