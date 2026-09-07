"""Direct-mode tests for Proof of Sweat.

These run the contract in-memory (no network / Docker) via genlayer-test's
direct fixtures, mocking the web read and the LLM jury. They cover the happy
path, every edge case with a UserError, and — most importantly — that the
validator DISAGREES when two validators reach different verdicts (the core
GenLayer consensus guarantee this project is built on).

    pip install "genlayer-test[sim]"
    pytest tests/ -v
"""
import json

CONTRACT = "contracts/proof_of_sweat.py"

REWARD = 1_000
STAKE = 100
URL = "https://example.com/deliverable"

GENUINE = json.dumps({"verdict": "GENUINE", "confidence": 90, "spec_match": 85,
                      "reason": "Original, on-spec work with concrete, verifiable detail."})
LOW_CONF_GENUINE = json.dumps({"verdict": "GENUINE", "confidence": 40, "spec_match": 80,
                               "reason": "Plausibly genuine but hard to be sure."})
AI_SLOP = json.dumps({"verdict": "AI_GENERATED", "confidence": 88, "spec_match": 20,
                      "reason": "Generic phrasing and hollow structure typical of AI generation."})


def _mock_ok(vm, llm_response=GENUINE, body="Real, specific deliverable content."):
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
                                "reason": "Completely different sentence, same conclusion."})
    _mock_ok(direct_vm, other_wording)
    assert direct_vm.run_validator() is True


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


# ── listing ──────────────────────────────────────────────────────────────────
def test_get_all_bounties(direct_vm, direct_deploy, direct_alice):
    c, _ = _new_bounty(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = REWARD
    c.create_bounty("Second", "Another spec", "", STAKE)
    direct_vm.value = 0
    allb = json.loads(c.get_all_bounties())
    assert len(allb) == 2
