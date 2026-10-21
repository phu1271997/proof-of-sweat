"""Direct-mode tests for the v0.6 Skeptics' Market.

The market layers a permissionless, staked second opinion on top of the jury's
own resolved verdicts: anyone can stake native GEN on GENUINE vs FAKE, and when
the stake window closes the contract settles the pot by running the SAME on-chain
AI courtroom again as a trustless settler. These tests cover:

  • zero-state views and the new config,
  • every payable / state guard with a UserError,
  • a full open → back → settle → split-pot flow (pro-rata to the winning side),
  • an OVERTURN that rewrites the worker's portable on-chain reputation,
  • a VOID (UNCLEAR re-trial) that refunds every staker, and
  • the consensus guarantee — two validators that reach different settling
    verdicts do NOT reach agreement (the GenLayer property the market relies on).

    pip install "genlayer-test[sim]"
    pytest tests/ -v
"""
import json
import datetime as _dt

CONTRACT = "contracts/proof_of_sweat.py"

REWARD = 1_000
STAKE = 100
URL = "https://example.com/deliverable"
CLEAN_SEARCH = "No results found. Your search did not match any documents."

_CWIN = 180                 # matches _DEFAULT_CHALLENGE_WINDOW_SECS in the contract
_BASE = 1_760_000_000

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
AI_SLOP = json.dumps({
    "verdict": "AI_GENERATED", "confidence": 88, "spec_match": 20,
    "authenticity": 15, "originality": 60,
    "reason": "Generic phrasing and hollow structure typical of AI generation.",
})


def _iso(epoch):
    return _dt.datetime.fromtimestamp(epoch, _dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _mock_ok(vm, llm_response=GENUINE, body="Real, specific deliverable content.",
             search_body=CLEAN_SEARCH):
    vm.mock_web(r".*duckduckgo.*", {"status": 200, "body": search_body})
    vm.mock_web(r".*", {"status": 200, "body": body})
    vm.mock_llm(r".*", llm_response)


def _approved_bounty(vm, deploy, client, worker, *, reward=REWARD, stake=STAKE):
    """Drive a bounty all the way to APPROVED (worker paid) at epoch _BASE."""
    c = deploy(CONTRACT)
    vm.warp(_iso(_BASE))
    vm.sender = client
    vm.value = reward
    bid = c.create_bounty("Write docs", "Document the API", "No AI-generated content.", stake)
    vm.value = 0
    vm.sender = worker
    vm.value = stake
    c.claim_bounty(bid)
    vm.value = 0
    c.submit_work(bid, URL)
    _mock_ok(vm, GENUINE)
    c.adjudicate(bid)
    assert json.loads(c.get_bounty(bid))["status"] == 3  # APPROVED
    return c, bid


def _fraud_bounty(vm, deploy, client, worker, *, reward=REWARD, stake=STAKE):
    """Drive a bounty to RESOLVED_FRAUD (client finalized after the window)."""
    c = deploy(CONTRACT)
    vm.warp(_iso(_BASE))
    vm.sender = client
    vm.value = reward
    bid = c.create_bounty("Write docs", "Document the API", "No AI content.", stake)
    vm.value = 0
    vm.sender = worker
    vm.value = stake
    c.claim_bounty(bid)
    vm.value = 0
    c.submit_work(bid, URL)
    _mock_ok(vm, AI_SLOP)
    c.adjudicate(bid)
    assert json.loads(c.get_bounty(bid))["status"] == 4  # REJECTED
    vm.warp(_iso(_BASE + 301))   # past the 300s appeal window
    vm.sender = client
    c.finalize_rejection(bid)
    vm.warp(_iso(_BASE))         # reset clock for the challenge flow
    assert json.loads(c.get_bounty(bid))["status"] == 6  # RESOLVED_FRAUD
    return c, bid


def _open(c, vm, bid, staker, side, amount):
    vm.sender = staker
    vm.value = amount
    cid = c.open_challenge(bid, side)
    vm.value = 0
    return cid


def _back(c, vm, bid, staker, side, amount):
    vm.sender = staker
    vm.value = amount
    c.back_challenge(bid, side)
    vm.value = 0


def _ch(c, bid):
    return json.loads(c.get_challenge(bid))


# ── zero state & config ──────────────────────────────────────────────────────
def test_zero_state_challenge_views(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    assert json.loads(c.get_all_challenges()) == []
    cfg = json.loads(c.get_config())
    assert cfg["challenge_window_secs"] == _CWIN
    assert cfg["total_challenges"] == 0


# ── open guards ──────────────────────────────────────────────────────────────
def test_open_requires_resolved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = REWARD
    bid = c.create_bounty("t", "s", "", STAKE)   # OPEN, not resolved
    direct_vm.value = 0
    direct_vm.sender = direct_bob
    direct_vm.value = STAKE
    with direct_vm.expect_revert("only a resolved bounty"):
        c.open_challenge(bid, "FAKE")
    direct_vm.value = 0


def test_open_zero_stake_reverts(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_charlie
    direct_vm.value = 0
    with direct_vm.expect_revert("must stake native GEN"):
        c.open_challenge(bid, "FAKE")


def test_open_bad_side_reverts(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.sender = direct_charlie
    direct_vm.value = STAKE
    with direct_vm.expect_revert("side must be"):
        c.open_challenge(bid, "MAYBE")
    direct_vm.value = 0


def test_open_links_bounty_and_sets_pot(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    _open(c, direct_vm, bid, direct_charlie, "FAKE", 500)
    b = json.loads(c.get_bounty(bid))
    assert b["challenge_id"] != ""
    ch = _ch(c, bid)
    assert ch["status"] == 0 and ch["open_now"] is True
    assert ch["pot_fake"] == "500" and ch["pot_genuine"] == "0"
    assert ch["original_verdict"] == "GENUINE"      # snapshotted jury stance
    assert len(ch["stakes"]) == 1


def test_only_one_challenge_per_bounty(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    _open(c, direct_vm, bid, direct_charlie, "FAKE", STAKE)
    direct_vm.sender = direct_charlie
    direct_vm.value = STAKE
    with direct_vm.expect_revert("already has a challenge"):
        c.open_challenge(bid, "GENUINE")
    direct_vm.value = 0


# ── window guards ────────────────────────────────────────────────────────────
def test_back_after_window_reverts(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    _open(c, direct_vm, bid, direct_charlie, "FAKE", STAKE)
    direct_vm.warp(_iso(_BASE + _CWIN + 1))
    direct_vm.sender = direct_charlie
    direct_vm.value = STAKE
    with direct_vm.expect_revert("stake window has closed"):
        c.back_challenge(bid, "FAKE")
    direct_vm.value = 0


def test_resolve_before_window_reverts(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    _open(c, direct_vm, bid, direct_charlie, "FAKE", STAKE)
    _mock_ok(direct_vm, AI_SLOP)
    with direct_vm.expect_revert("stake window is still open"):
        c.resolve_challenge(bid)


# ── full flow: uphold GENUINE, winners split the whole pot pro-rata ───────────
def test_resolve_upholds_genuine_and_splits_pot(direct_vm, direct_deploy, direct_alice, direct_bob, direct_accounts):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    g1, g2, f1 = direct_accounts[0], direct_accounts[1], direct_accounts[2]
    _open(c, direct_vm, bid, g1, "GENUINE", 100)   # winning side
    _back(c, direct_vm, bid, g2, "GENUINE", 300)   # winning side
    _back(c, direct_vm, bid, f1, "FAKE", 200)      # losing side
    ch = _ch(c, bid)
    assert ch["pot_total"] == "600"

    direct_vm.warp(_iso(_BASE + _CWIN + 1))
    _mock_ok(direct_vm, GENUINE)                   # fresh re-trial upholds GENUINE
    verdict = c.resolve_challenge(bid)
    assert verdict == "GENUINE"

    ch = _ch(c, bid)
    assert ch["status"] == 1                       # C_RESOLVED
    assert ch["winning_side"] == 1                 # W_GENUINE
    assert ch["overturned"] is False               # agrees with the jury

    stakes = {s["addr"]: s for s in ch["stakes"]}
    addr_g1 = next(a for a, s in stakes.items() if s["side"] == "GENUINE" and s["amount"] == "100")
    addr_g2 = next(a for a, s in stakes.items() if s["side"] == "GENUINE" and s["amount"] == "300")
    addr_f1 = next(a for a, s in stakes.items() if s["side"] == "FAKE")
    # Whole 600 pot split pro-rata across the GENUINE side (100:300) → 150 / 450.
    assert c.get_credit(addr_g1) == "150"
    assert c.get_credit(addr_g2) == "450"
    assert c.get_credit(addr_f1) == "0"            # losing side wins nothing
    # worker's reputation untouched (verdict upheld, no overturn)
    assert json.loads(c.get_reputation(json.loads(c.get_bounty(bid))["worker"]))["fraud"] == 0


# ── overturn: a staked crowd + fresh AI panel flip the record ────────────────
def test_resolve_overturns_to_fake_and_marks_worker(direct_vm, direct_deploy, direct_alice, direct_bob, direct_accounts):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    worker = json.loads(c.get_bounty(bid))["worker"]
    assert json.loads(c.get_reputation(worker))["genuine"] == 1   # jury paid them

    f1, g1 = direct_accounts[0], direct_accounts[1]
    _open(c, direct_vm, bid, f1, "FAKE", 400)      # skeptic
    _back(c, direct_vm, bid, g1, "GENUINE", 100)   # defender
    direct_vm.warp(_iso(_BASE + _CWIN + 1))
    direct_vm.clear_mocks()
    _mock_ok(direct_vm, AI_SLOP)                    # fresh re-trial says FRAUD
    verdict = c.resolve_challenge(bid)
    assert verdict == "AI_GENERATED"

    ch = _ch(c, bid)
    assert ch["winning_side"] == 2                 # W_FAKE
    assert ch["overturned"] is True                # flips the jury's GENUINE
    stakes = {s["side"]: s["addr"] for s in ch["stakes"]}
    assert c.get_credit(stakes["FAKE"]) == "500"   # takes the whole 500 pot
    assert c.get_credit(stakes["GENUINE"]) == "0"
    # the worker's portable reputation now carries a fraud mark
    assert json.loads(c.get_reputation(worker))["fraud"] == 1


def test_resolve_overturns_fraud_to_genuine(direct_vm, direct_deploy, direct_alice, direct_bob, direct_accounts):
    c, bid = _fraud_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    worker = json.loads(c.get_bounty(bid))["worker"]
    g1 = direct_accounts[0]
    _open(c, direct_vm, bid, g1, "GENUINE", 300)
    direct_vm.warp(_iso(_BASE + _CWIN + 1))
    direct_vm.clear_mocks()
    _mock_ok(direct_vm, GENUINE)                    # fresh re-trial clears the worker
    verdict = c.resolve_challenge(bid)
    assert verdict == "GENUINE"
    ch = _ch(c, bid)
    assert ch["winning_side"] == 1 and ch["overturned"] is True
    assert json.loads(c.get_reputation(worker))["genuine"] == 1   # record corrected


# ── void: an UNCLEAR re-trial refunds everyone ───────────────────────────────
def test_unclear_retrial_voids_and_refunds(direct_vm, direct_deploy, direct_alice, direct_bob, direct_accounts):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    f1, g1 = direct_accounts[0], direct_accounts[1]
    _open(c, direct_vm, bid, f1, "FAKE", 200)
    _back(c, direct_vm, bid, g1, "GENUINE", 300)
    direct_vm.warp(_iso(_BASE + _CWIN + 1))
    # dead link on the re-trial → UNCLEAR → VOID
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": ""})
    direct_vm.mock_llm(r".*", GENUINE)
    verdict = c.resolve_challenge(bid)
    assert verdict == "UNCLEAR"
    ch = _ch(c, bid)
    assert ch["status"] == 2                        # C_VOID
    stakes = {s["side"]: s for s in ch["stakes"]}
    assert c.get_credit(stakes["FAKE"]["addr"]) == "200"    # own stake back
    assert c.get_credit(stakes["GENUINE"]["addr"]) == "300"


# ── consensus guarantee on the settling re-trial ─────────────────────────────
def test_challenge_consensus_disagrees_on_different_verdict(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    _open(c, direct_vm, bid, direct_charlie, "FAKE", STAKE)
    direct_vm.warp(_iso(_BASE + _CWIN + 1))
    _mock_ok(direct_vm, GENUINE)
    c.resolve_challenge(bid)                        # leader settled on GENUINE
    # a validator that re-tries and sees FRAUD must NOT agree on the settlement
    direct_vm.clear_mocks()
    _mock_ok(direct_vm, AI_SLOP)
    assert direct_vm.run_validator() is False


def test_challenge_consensus_agrees_on_same_verdict(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid = _approved_bounty(direct_vm, direct_deploy, direct_alice, direct_bob)
    _open(c, direct_vm, bid, direct_charlie, "FAKE", STAKE)
    direct_vm.warp(_iso(_BASE + _CWIN + 1))
    _mock_ok(direct_vm, GENUINE)
    c.resolve_challenge(bid)
    assert direct_vm.run_validator() is True
