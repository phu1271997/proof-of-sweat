import React, { useEffect, useMemo, useState } from 'react';
import '../landing.css';
import { linkProps } from '../lib/nav.js';
import { useReveal } from '../lib/useReveal.js';
import { fetchBounties, fetchConfig, CONTRACT, contractConfigured } from '../lib/genlayer.js';
import { formatGen, STATUS, VERDICT, EXPLORER } from '../lib/format.js';
import { Meter } from '../components/ui.jsx';

const REPO = 'https://github.com/phu1271997/proof-of-sweat';
const CONTRACT_URL = `${EXPLORER}/address/${CONTRACT}`;

export default function Landing() {
  const [bounties, setBounties] = useState([]);
  const [config, setConfig] = useState({});

  useEffect(() => {
    if (!contractConfigured()) return;
    Promise.all([fetchBounties(), fetchConfig()])
      .then(([b, c]) => { setBounties(b); setConfig(c || {}); })
      .catch(() => {});
  }, []);

  const examples = useMemo(() => {
    const byVerdict = (v) => bounties.find((b) => b.verdict === v);
    return [byVerdict('GENUINE'), byVerdict('AI_GENERATED'), byVerdict('PLAGIARIZED')].filter(Boolean);
  }, [bounties]);

  const stats = useMemo(() => {
    let escrowed = 0n;
    for (const b of bounties) { try { escrowed += BigInt(b.reward); } catch {} }
    const ruled = bounties.filter((b) => b.verdict).length;
    return {
      posted: config.total_bounties ?? bounties.length,
      escrowed: formatGen(escrowed),
      ruled,
      threshold: config.confidence_threshold ?? 60,
    };
  }, [bounties, config]);

  return (
    <div className="ld">
      <Nav />
      <Hero examples={examples} />
      <StatBar stats={stats} />
      <HowItWorks />
      <Verdicts examples={examples} />
      <WhyGenLayer />
      <Features />
      <Architecture ruled={stats.ruled} posted={stats.posted} />
      <Faq />
      <CtaBand />
      <Footer />
    </div>
  );
}

// ── navigation ────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav className={`ld-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <a className="ld-brand" {...linkProps('/')}>
        <img className="ld-brand-mark" src="/logo.png" alt="Proof of Sweat" />
        <span className="ld-brand-name">Proof of Sweat</span>
      </a>
      <div className="ld-nav-links">
        <a href="#how">How it works</a>
        <a href="#verdicts">Verdicts</a>
        <a href="#why">Why GenLayer</a>
        <a {...linkProps('/explorer')}>Explorer</a>
        <a href="#faq">FAQ</a>
      </div>
      <a className="ld-btn ld-btn-primary ld-nav-cta" {...linkProps('/app')}>Launch app</a>
    </nav>
  );
}

// ── hero ──────────────────────────────────────────────────────────────────────
function Hero({ examples }) {
  return (
    <header className="ld-hero">
      <div className="ld-hero-copy">
        <div className="ld-eyebrow">GenLayer · Future of Work</div>
        <h1 className="ld-hero-title">
          Get paid for real work.<br />
          <span className="ld-muted-title">AI slop gets nothing.</span>
        </h1>
        <p className="ld-hero-sub">
          Escrow a bounty. A jury of AI validators reads the deliverable on-chain and pays out
          only for genuine human work.
        </p>
        <div className="ld-hero-cta">
          <a className="ld-btn ld-btn-primary" {...linkProps('/app')}>Launch app</a>
          <a className="ld-btn ld-btn-ghost" href="#how">See how it works</a>
        </div>
      </div>
      <div className="ld-hero-visual" aria-hidden={examples.length === 0}>
        <HeroPreview examples={examples} />
      </div>
    </header>
  );
}

function HeroPreview({ examples }) {
  const show = examples.slice(0, 3);
  if (show.length === 0) {
    return (
      <div className="ld-preview">
        {[0, 1, 2].map((i) => <div key={i} className="ld-preview-skel" />)}
      </div>
    );
  }
  return (
    <div className="ld-preview">
      {show.map((b) => {
        const v = VERDICT[b.verdict];
        return (
          <div key={b.id} className={`ld-preview-card tone-${v.tone}`}>
            <div className="ld-preview-top">
              <span className={`ld-verdict-chip tone-${v.tone}`}>{v.label}</span>
              <span className="ld-mono">{b.confidence}% conf</span>
            </div>
            <div className="ld-preview-title">{b.title}</div>
            <div className="ld-preview-reason">{clip(b.reason, 150)}</div>
            <div className="ld-preview-foot">
              <span className="ld-mono">{formatGen(b.reward)} GEN</span>
              <span>{STATUS[b.status].label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── live stat bar ─────────────────────────────────────────────────────────────
function StatBar({ stats }) {
  const items = [
    [stats.posted, 'bounties posted'],
    [`${stats.escrowed}`, 'GEN in bounties'],
    [stats.ruled, 'verdicts rendered'],
    [`${stats.threshold}%`, 'min confidence to pay'],
  ];
  return (
    <section className="ld-statbar">
      {items.map(([n, l]) => (
        <div key={l} className="ld-stat">
          <div className="ld-stat-n ld-mono">{n}</div>
          <div className="ld-stat-l">{l}</div>
        </div>
      ))}
      <div className="ld-stat ld-stat-live"><span className="ld-live-dot" />live from studionet</div>
    </section>
  );
}

// ── how it works ──────────────────────────────────────────────────────────────
const STEPS = [
  ['Post', 'A client escrows the reward in GEN and writes the spec plus the rules the work must follow.'],
  ['Claim', 'A worker locks a stake to take the bounty. Skin in the game, slashed if the work is fraudulent.'],
  ['Submit', 'The worker submits a public URL: a gist, a pull request, an article, a portfolio page.'],
  ['Settle', 'Validators read the deliverable on-chain, reach consensus on a verdict, and the contract pays out.'],
];
function HowItWorks() {
  const [ref, shown] = useReveal();
  return (
    <section id="how" className="ld-section ld-how" ref={ref}>
      <div className="ld-section-head">
        <div className="ld-eyebrow">How it works</div>
        <h2 className="ld-h2">Four moves, one honest payout.</h2>
      </div>
      <ol className={`ld-steps ${shown ? 'is-in' : ''}`}>
        {STEPS.map(([t, d], i) => (
          <li key={t} className="ld-step" style={{ '--i': i }}>
            <div className="ld-step-n ld-mono">{i + 1}</div>
            <div className="ld-step-title">{t}</div>
            <div className="ld-step-body">{d}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── real verdicts ─────────────────────────────────────────────────────────────
function Verdicts({ examples }) {
  const [ref, shown] = useReveal();
  return (
    <section id="verdicts" className="ld-section" ref={ref}>
      <div className="ld-section-head">
        <h2 className="ld-h2">Real verdicts, decided on-chain.</h2>
        <p className="ld-lead">
          Every judgment below was produced by validator consensus reading the actual deliverable.
          The reasoning is the AI's own, written on-chain, not a template.
        </p>
      </div>
      <div className={`ld-verdicts ${shown ? 'is-in' : ''}`}>
        {examples.length === 0
          ? [0, 1, 2].map((i) => <div key={i} className="ld-verdict-row ld-skel" style={{ '--i': i }} />)
          : examples.map((b, i) => <VerdictRow key={b.id} b={b} i={i} />)}
      </div>
    </section>
  );
}

function VerdictRow({ b, i }) {
  const v = VERDICT[b.verdict];
  const paid = b.status === 3;
  return (
    <article className={`ld-verdict-row tone-${v.tone}`} style={{ '--i': i }}>
      <div className="ld-verdict-left">
        <span className={`ld-verdict-big tone-${v.tone}`}>{v.label}</span>
        <span className={`ld-verdict-outcome ${paid ? 'paid' : 'rejected'}`}>
          {paid ? 'Worker paid' : 'Payment withheld'}
        </span>
        <div className="ld-verdict-meters">
          <Meter label="Confidence" value={b.confidence} tone={v.tone} />
          <Meter label="Spec match" value={b.spec_match} tone="cyan" />
        </div>
      </div>
      <div className="ld-verdict-right">
        <div className="ld-verdict-spec">{b.title}</div>
        <blockquote className="ld-verdict-quote">{clip(b.reason, 260)}</blockquote>
        {b.deliverable_url && (
          <a className="ld-verdict-link ld-mono" href={b.deliverable_url} target="_blank" rel="noreferrer">
            deliverable the jury read
          </a>
        )}
      </div>
    </article>
  );
}

// ── why GenLayer ──────────────────────────────────────────────────────────────
function WhyGenLayer() {
  const [ref, shown] = useReveal();
  const ordinary = [
    'Cannot read the deliverable. It only sees a URL string.',
    'Cannot tell original work from AI slop or a copied page.',
    'Needs a trusted human or a centralized oracle to decide.',
    'Releases on a signature, not on whether the work is real.',
  ];
  const genlayer = [
    'Reads the deliverable directly on-chain, no oracle.',
    'Judges authenticity with an LLM at the consensus layer.',
    'Validators run different models and converge on one verdict.',
    'Releases funds only when the work is judged genuine.',
  ];
  return (
    <section id="why" className={`ld-section ld-why ${shown ? 'is-in' : ''}`} ref={ref}>
      <div className="ld-section-head">
        <h2 className="ld-h2">Why it can only exist on GenLayer.</h2>
        <p className="ld-lead">
          The escrow release is itself a subjective judgment over live web content. That is exactly
          the thing an ordinary smart contract cannot do.
        </p>
      </div>
      <div className="ld-compare">
        <div className="ld-compare-col is-off">
          <div className="ld-compare-h">An ordinary smart contract</div>
          <ul>{ordinary.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="ld-compare-col is-on">
          <div className="ld-compare-h">Proof of Sweat on GenLayer</div>
          <ul>{genlayer.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}

// ── features (bento) ──────────────────────────────────────────────────────────
function Features() {
  const [ref, shown] = useReveal();
  return (
    <section className={`ld-section ${shown ? 'is-in' : ''}`} ref={ref}>
      <div className="ld-section-head">
        <div className="ld-eyebrow">Under the hood</div>
        <h2 className="ld-h2">Built to be judged, not gamed.</h2>
      </div>
      <div className="ld-bento">
        <div className="ld-cell ld-cell-wide ld-cell-accent">
          <h3>Consensus on the verdict, not the wording</h3>
          <p>
            Validators agree when they reach the same verdict and disagree when they do not, even if
            each writes a different reason. Two honest reviewers never split over phrasing, and two
            reviewers who reach opposite verdicts can never both pass.
          </p>
          <code className="ld-code">validator_fn: mine["verdict"] == leader["verdict"]</code>
        </div>
        <div className="ld-cell">
          <h3>Appeal court</h3>
          <p>A rejected worker can stake a bond and force a stricter second review. Overturned means paid; upheld means the client keeps the bond.</p>
        </div>
        <div className="ld-cell ld-cell-tint">
          <h3>Portable reputation</h3>
          <p>Genuine and fraud counts, a trust score, and total GEN earned accrue on-chain per worker from real adjudicated outcomes.</p>
        </div>
        <div className="ld-cell">
          <h3>Pull-payment escrow</h3>
          <p>Balances are credited then withdrawn, reentrancy-safe. Native GEN reaches the worker through the chain-layer message.</p>
        </div>
        <div className="ld-cell ld-cell-tint">
          <h3>Reads the open web</h3>
          <p>The jury fetches the deliverable itself with on-chain web rendering. No oracle stands between the work and the verdict.</p>
        </div>
      </div>
    </section>
  );
}

// ── architecture / proof ──────────────────────────────────────────────────────
function Architecture({ ruled, posted }) {
  const [ref, shown] = useReveal();
  const rows = [
    ['Contract', 'Python Intelligent Contract on GenLayer studionet'],
    ['Consensus', 'gl.vm.run_nondet with a custom verdict-comparing validator'],
    ['Tests', '22 direct-mode gltest cases, including the consensus guarantee'],
    ['Frontend', 'React and genlayer-js, signed by MetaMask'],
  ];
  return (
    <section className={`ld-section ld-arch ${shown ? 'is-in' : ''}`} ref={ref}>
      <div className="ld-arch-grid">
        <div>
          <h2 className="ld-h2">Everything runs on-chain, and you can check it.</h2>
          <p className="ld-lead">
            {posted} bounties posted and {ruled} verdicts rendered on studionet so far. The contract
            is public, the tests pass, and every transaction is on the explorer.
          </p>
          <div className="ld-arch-links">
            <a className="ld-btn ld-btn-ghost" href={CONTRACT_URL} target="_blank" rel="noreferrer">View contract on explorer</a>
            <a className="ld-btn ld-btn-ghost" href={REPO} target="_blank" rel="noreferrer">Read the source</a>
          </div>
          <div className="ld-arch-addr ld-mono">{CONTRACT}</div>
        </div>
        <dl className="ld-spec">
          {rows.map(([k, val]) => (
            <div key={k} className="ld-spec-row">
              <dt>{k}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ── faq ───────────────────────────────────────────────────────────────────────
const FAQS = [
  ['Who decides if the work is genuine?', 'No single party. A set of GenLayer validators each run a language model, read the deliverable, and vote. The contract settles on the verdict they agree on.'],
  ['What stops a worker from submitting AI-generated text?', 'The jury is tuned to flag machine-generation hallmarks and copied content, and to pay only when the work shows authentic, on-spec authorship. In testing it caught AI filler and a copied documentation page while approving genuine first-person work.'],
  ['What if the worker thinks the verdict is wrong?', 'They can appeal by staking a bond, which triggers a stricter second review. If the appeal overturns the ruling they are paid; if it is upheld the client keeps the bond.'],
  ['Is real money at stake?', 'Yes. Rewards and stakes are native GEN escrowed by the contract on studionet, released or slashed based on the verdict.'],
  ['What network is this on?', 'GenLayer studionet, the hosted GenLayer Studio network. The listing shows as Preview because it is a Studio deployment.'],
];
function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="ld-section ld-faq">
      <h2 className="ld-h2">Questions.</h2>
      <div className="ld-faq-list">
        {FAQS.map(([q, a], i) => (
          <div key={q} className={`ld-faq-item ${open === i ? 'is-open' : ''}`}>
            <button className="ld-faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <span>{q}</span>
              <span className="ld-faq-icon" aria-hidden>{open === i ? '−' : '+'}</span>
            </button>
            <div className="ld-faq-a"><p>{a}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── cta + footer ──────────────────────────────────────────────────────────────
function CtaBand() {
  return (
    <section className="ld-cta">
      <h2 className="ld-cta-title">Put a verdict on the line.</h2>
      <p className="ld-cta-sub">Post a bounty or claim one, and watch the AI jury settle it live.</p>
      <a className="ld-btn ld-btn-primary ld-btn-lg" {...linkProps('/app')}>Launch app</a>
    </section>
  );
}

function Footer() {
  return (
    <footer className="ld-footer">
      <div className="ld-footer-brand">
        <img className="ld-brand-mark" src="/logo.png" alt="Proof of Sweat" />
        <span>Proof of Sweat</span>
      </div>
      <div className="ld-footer-links">
        <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
        <a href={CONTRACT_URL} target="_blank" rel="noreferrer">Explorer</a>
        <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a>
        <a {...linkProps('/app')}>Launch app</a>
      </div>
      <div className="ld-footer-note">Built on GenLayer studionet for the Agent Tank hackathon.</div>
    </footer>
  );
}

function clip(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}
