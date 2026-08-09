# Funding Your Master of Accounting: Roth IRA vs. 529 vs. Loans vs. Cash
### A quantitative decision analysis

*Prepared as if by a CFA / CFP / CPA. This is educational financial modeling, not individualized investment, tax, or legal advice — I am not your fiduciary advisor, and you should confirm state-specific and personal tax facts with a licensed professional before acting.*

---

## 1. Bottom line up front

Across **every** return assumption you asked me to test (7%–11%) and **both** horizons (age 60 and 65), the ranking does not change:

| Rank | Strategy | Why |
|---|---|---|
| **1** | **Keep maxing the Roth; fund the MAC shortfall with a federal Grad Direct Unsubsidized loan** (Scenario 1) | Preserves every dollar of irreplaceable Roth space; the loan is cheap (7.94%), the interest is tax-deductible, and payments land *later* so they cost less in opportunity terms. |
| **2** | **Keep maxing the Roth; pay the shortfall in cash** (Scenario 4) | Also preserves Roth space; loses the small loan-arbitrage edge but eliminates debt and market risk. Trails #1 by only ~$23k (age 60). |
| **3** | Split between Roth and 529 (Scenario 3) | Dominated — the math is a straight line, so any redirect is strictly worse than zero redirect. Optimal split = **0% redirected.** |
| **4 (worst)** | **Redirect Roth contributions into the 529** (Scenario 2) | Permanently destroys Roth contribution room. Costs **~$51k more at 60 / ~$76k more at 65** than the best strategy in the base case. |

**The single most important idea:** *Roth contribution room is a scarce, annual, use-it-or-lose-it resource.* You can never go back and fill 2026's Roth room in 2035. Every other input in this problem is recoverable or financeable — only Roth room is not. So the optimal strategy is the one that **never sacrifices Roth space**, and funds the degree with the cheapest capital that leaves that space intact.

---

## 2. The core insight, stated precisely

There are two candidate "binding constraints" in your situation, and the whole answer hinges on which one is truly binding:

- **If money is the constraint** (you simply don't have enough cash), the instinct is "move money to the 529." But that quietly spends your Roth *room*, which is the more valuable resource.
- **If Roth room is the constraint** (which it is — the 2025 limit is $7,000, rising to $7,500 in 2026, and it resets to zero each year), then the correct move is to protect that room and finance the degree with fungible, replaceable dollars (a loan, or ordinary cash).

A dollar left inside the Roth compounds **tax-free** for ~38–43 years. A dollar redirected to the 529 is **spent on tuition** and compounds for zero years. So redirecting doesn't "move" your money to a slightly-less-good account — it **consumes** your most valuable tax shelter to avoid a modest, deductible, 7.94% loan. That trade is almost never worth it.

> One nuance that *reinforces* this: a Roth IRA has a single combined contribution limit regardless of who funds it. If you contribute the full limit yourself, your dad's "matching" gift cannot *also* go into the Roth — so if his match is currently what fills your Roth, redirecting *his* portion to the 529 is what costs you the room. If instead his match is over-the-limit money that could never have been sheltered, then redirecting it costs you *nothing* in Roth space and Scenario 2 becomes merely "pay cash through a 529" — perfectly fine. **Confirm which case you're in; it's the crux.** The model below assumes the binding case (redirected dollars would otherwise have been sheltered).

---

## 3. Assumptions (all adjustable in the dashboard)

| Input | Base value | Notes |
|---|---|---|
| Current age / funding age | 21 / 22 | MAC paid immediately after undergrad |
| MAC total cost | $28,000 | Your figure |
| 529 available for the MAC | $13,000 | ⇒ **shortfall = $15,000** to finance (adjust to your real leftover) |
| Roth annual contribution | $7,000 | 2025 limit; $7,500 in 2026 |
| Investment return *r* | 7%–11% | Nominal, pre-tax |
| Inflation | 3% | For real-dollar discussion |
| Grad Direct Unsubsidized loan | **7.94%** + 1.057% fee | 2025–26 federal rate |
| Grad PLUS loan | **8.94%** + 4.228% fee | 2025–26 federal rate |
| Repayment term | 5 / 10 / 15 yr | |
| LTCG tax on taxable growth | 15% | Applied once at horizon |
| Marginal rate for loan-interest deduction | 22% | Above-the-line, ≤ $2,500/yr, phases out $85k–$100k MAGI (single) |
| Horizon | age 60 and 65 | |

---

## 4. Methodology & formulas

**Common baseline.** Every scenario is scored against the *same* baseline — "the MAC is free and the Roth is maxed every year" — and charged a **cost** equal to the dollars it removes from your net worth at the horizon, valued with the correct tax wrapper. Because the baseline is identical for all scenarios, the ranking depends only on cost (lower = better), and "net worth vs. best" = *Cost*ᵢ − *Cost*_best.

**Tax wrappers (the whole game is here):**

- **Roth room lost** → tax-free growth lost: `Cost = A · (1+r)^n`
- **Cash spent** → taxable growth lost (taxed once at horizon): `Cost = FV − 0.15·(FV − basis)`, where `FV = A·(1+r)^n`
- **Loan payments** → taxable opportunity cost of each payment, minus the deduction benefit:
  `Cost = Σ Pₜ·(1+r)^(n−t) · (after-tax) − Σ min(interestₜ, 2500)·(marginal rate)·(1+r)^(n−t)`

**Loan payment** (standard amortization): `P = L · i / (1 − (1+i)^(−N))`, monthly `i = rate/12`, `N = 12·term`; principal `L = shortfall / (1 − fee)` to net the shortfall after the origination fee.

**Full-career Roth balance:** `Σ (age=22→H−1) 7000·(1+r)^(H−age)`.

**Key modeling choice (stated explicitly):** every MAC-related outflow is assumed to displace *taxable investment* at rate *r* (a conservative opportunity cost). If those dollars would instead have been *consumed*, financing options (loans) look even better, because deferred spending is cheaper.

---

## 5. Scenario definitions

- **Scenario 1 — Max Roth + Loan.** Contribute the full Roth every year; borrow the $15,000 shortfall (Grad Unsubsidized) and repay from future income.
- **Scenario 2 — Redirect Roth → 529.** Divert your Roth-bound contributions (~2 years' worth) into the 529 until the shortfall is covered; no loan; resume Roth afterward.
- **Scenario 3 — Split.** Some to Roth, some to 529. Find the optimal fraction.
- **Scenario 4 — Max Roth + Cash.** Contribute the full Roth; pay the shortfall in cash.
- **Scenario 5 — Anything better.** The engineered optimum (below).

---

## 6. Base-case results ($15,000 shortfall, 10-yr term, Grad Unsubsidized)

**Impact on net worth at age 60** (r = 8%):

| Scenario | Cost to age-60 net worth | Vs. best | Roth @ 60 | Loan interest | Out-of-pocket |
|---|---|---|---|---|---|
| **1 — Max Roth + Loan** ✅ | **$216,286** | **—** | $1,665,589 | $6,854 | $22,015 |
| 4 — Max Roth + Cash | $239,722 | +$23,436 | $1,665,589 | $0 | $15,000 |
| 2 — Redirect Roth → 529 ❌ | $267,064 | +$50,778 | **$1,398,524** | $0 | $0 |

**Impact on net worth at age 65** (r = 8%):

| Scenario | Cost to age-65 net worth | Vs. best | Roth @ 65 | Loan interest | Out-of-pocket |
|---|---|---|---|---|---|
| **1 — Max Roth + Loan** ✅ | **$316,246** | **—** | $2,491,648 | $6,854 | $22,015 |
| 4 — Max Roth + Cash | $351,175 | +$34,929 | $2,491,648 | $0 | $15,000 |
| 2 — Redirect Roth → 529 ❌ | $392,405 | +$76,160 | **$2,099,242** | $0 | $0 |

Read the "Roth @ horizon" column: redirecting **permanently shrinks your retirement Roth by $267,000 (age 60) / $392,000 (age 65)** to avoid ~$6,854 of deductible loan interest. That is the entire argument in one row.

---

## 7. Rankings, and the exact lifetime dollars gained or lost

Relative to the optimal strategy, here is what each choice **costs you at retirement** (base case):

| Choice | Lifetime cost vs. optimal @ 60 | @ 65 | In today's dollars (3% infl.) @ 60 / 65 |
|---|---|---|---|
| **#1 Max Roth + Loan** | $0 | $0 | $0 |
| #2 Max Roth + Cash | −$23,436 | −$34,929 | −$7,600 / −$9,800 |
| #4 Redirect Roth → 529 | **−$50,778** | **−$76,160** | **−$16,514 / −$21,366** |

So the "cost of redirecting Roth money" — the specific figure you asked for — is about **$50,800 at 60 or $76,200 at 65** (≈ **$16,500–$21,400 in today's purchasing power**), versus the best strategy. The gap widens as returns rise (see §8).

---

## 8. Sensitivity analysis — what actually changes the answer

**(a) Investment return (7%–11%): the ranking never flips.** The redirect penalty only grows with higher returns, because you're forfeiting more tax-free compounding.

| r | Redirect penalty vs. best @ 60 | @ 65 |
|---|---|---|
| 7% | +$28,514 | +$41,321 |
| 8% | +$50,778 | +$76,160 |
| 9% | +$84,967 | +$132,512 |
| 10% | +$136,647 | +$222,087 |
| 11% | +$213,747 | +$362,439 |

**(b) Loan vs. cash — the only thing that flips, and it flips on the loan rate, not the return.** With the cheap Grad *Unsubsidized* loan (7.94%), keeping cash invested and borrowing wins at essentially every return ≥ 6%. With *Grad PLUS* (8.94% + 4.2% fee), paying **cash** wins below ~7% returns and the loan wins above:

| r | Unsub 7.94% → winner | Grad PLUS 8.94% → winner |
|---|---|---|
| 6.0% | Loan (barely) | **Cash** |
| 7.0% | Loan | **Cash** |
| 7.5% | Loan | Loan |
| ≥ 8% | Loan | Loan |

**Rule of thumb:** finance only if you genuinely expect your **after-tax** investment return to beat your **after-tax** loan rate — and only with the low-fee Unsubsidized loan, never Grad PLUS.

**(c) Repayment term (r = 8%).** In pure opportunity-cost terms a longer term looks "cheaper" because payments are deferred — *but* only if you actually invest the deferred cash at *r*, and you pay far more total interest. If you won't reliably out-earn the loan rate, choose the **shorter** term.

| Term | Annual payment | Total paid | Total interest |
|---|---|---|---|
| 5 yr | $3,684 | $18,418 | $3,257 |
| 10 yr | $2,201 | $22,015 | $6,854 |
| 15 yr | $1,732 | $25,984 | $10,824 |

**(d) Shortfall size.** The redirect penalty scales with how much you'd move: from ~$32k (an $8k shortfall) to ~$63k (the full $28k) at age 60. Bigger gap ⇒ bigger reason not to raid the Roth.

**(e) Tuition inflation (5%/yr).** If the MAC costs more than $28k, the shortfall and every cost grows proportionally, but the *ranking is unchanged* — redirecting stays worst.

**Which assumptions change the recommendation?** Only the **loan rate vs. expected return** comparison changes anything — and it only decides **cash vs. loan for 2nd place mechanics**. *Nothing* in the tested ranges makes redirecting the Roth anything but last.

---

## 9. Break-even / "optimal split" (Scenario 3)

Total cost is **linear** in the fraction you redirect, because each redirected dollar carries a fixed penalty. At r = 8%, age 60:

- Cost per $1 kept in the Roth and funded the cheapest way: **$14.42** of age-60 wealth
- Cost per $1 redirected out of the Roth: **$18.63**
- **Penalty per $1 redirected: $4.21** (age 60) / **$6.28** (age 65)

Because the penalty is positive and constant, the objective has no interior minimum — the optimum is the **corner: redirect 0%.** There is no clever "split." The break-even redirect fraction is 0%.

---

## 10. Tax considerations

- **Roth IRA space** — the crown jewel. After-tax in, tax-free growth, tax-free qualified withdrawals, no RMDs. The annual limit ($7,000 → $7,500) is **use-it-or-lose-it**; skipped years are gone forever. This is exactly why redirecting is so costly. (Also: Roth contributions require **earned income** — you can only contribute up to what you earn, capped at the limit. If your earned income is below $7,000 in a given year, that caps you regardless.)
- **529 tax advantages** — tax-free growth and tax-free **qualified** withdrawals; graduate tuition qualifies. Many states also give an **income-tax deduction or credit** for contributions (e.g., New York: up to $5,000 single / $10,000 joint). If your state offers this, there's a *free* optimization: **route your MAC cash *through* the 529** — contribute, capture the state deduction, then withdraw for tuition — but fund it with **ordinary cash, not by sacrificing Roth room.** Check your state's rules on same-year contribute-and-withdraw.
- **Student-loan interest deduction** — up to **$2,500/yr, above-the-line** (no itemizing needed), phasing out at $85k–$100k MAGI (single) / $170k–$200k (joint) for 2025. It modestly lowers the true cost of the federal loan. Note you generally can't claim it while a dependent on someone else's return, and only federal/qualified education loans count — **HELOC and SBLOC interest do *not* qualify.**
- **SECURE 2.0 529→Roth rollover** — leftover 529 funds (up to a **$35,000 lifetime** cap, subject to the account being open ≥15 years, annual Roth limits, and earned income) can eventually roll into the beneficiary's Roth. This means a modest 529 is not "trapped," and it's a reason not to *fear* the 529 — but it does **not** rescue Scenario 2, because in that scenario the 529 money is spent on tuition, leaving nothing to roll.

---

## 11. HELOC and SBLOC — verdict

You asked about these. For a student funding a degree, both are **inferior to a federal Grad Unsubsidized loan** and I'd rank them below every core scenario:

- **HELOC (~8–9%, variable):** interest is **not** deductible when proceeds pay tuition (only home acquisition/improvement qualifies), the rate floats upward with the Fed, and it puts a **home** (presumably your family's) up as collateral. Higher effective cost and real downside risk.
- **SBLOC (~6–9%, variable):** cheaper headline rate, but **margin-call risk** — if the pledged portfolio drops, you can be forced to liquidate at the worst time; interest isn't education-deductible; rate floats. It's leverage against the very assets you're trying to grow.

Both trade a small potential rate saving for **collateral risk, rate risk, and lost deductibility.** Use the federal Unsubsidized loan (fixed rate, deferment options, deductible interest, no collateral) if you borrow at all.

---

## 12. The optimal strategy (Scenario 5)

**Never touch the Roth. Fund the gap with the cheapest room-preserving capital, and grab any free state 529 deduction on the way.** Concretely:

1. **Max the Roth every year, without interruption** (subject to your earned income). This is non-negotiable — it's the one irreplaceable asset in the problem.
2. **Apply the entire 529 balance to the MAC first** (tax-free, already earmarked).
3. **Fund the remaining shortfall with the cheapest room-preserving source:**
   - If you have investable cash *and* you're risk-averse or value being debt-free → **pay cash** (Scenario 4). You give up only ~$23k of expected upside vs. the loan, in exchange for zero debt and zero market risk — often a fair trade.
   - If you're comfortable bearing market risk and expect to out-earn ~8% after tax → take the **federal Grad Direct Unsubsidized loan** (Scenario 1) and keep your cash invested. Use the shortest term you can service if you're *not* confident about out-earning the rate.
   - If your state gives a 529 deduction, **run the cash through the 529** to capture it, then withdraw for tuition.
4. **Avoid Grad PLUS, HELOC, and SBLOC** unless the Unsubsidized loan is unavailable.
5. **Look for gap-shrinkers** that dominate all of this: a **graduate assistantship / tuition waiver**, employer tuition support, or in-state/accelerated 4+1 pricing. Every dollar of shortfall you eliminate is worth ~$14 of age-60 net worth — a far bigger lever than the financing choice.

---

## 13. Non-financial considerations

The dollar model says "loan," but expected value isn't the whole decision:

- **Risk.** The loan's edge over cash is an *expected* edge that requires you to actually earn > ~8% after tax over decades while carrying certain debt. Paying cash converts an uncertain market bet into a **guaranteed 7.94% "return"** (the interest you don't pay). For a risk-averse person, cash's ~$23k shortfall vs. the loan is cheap insurance.
- **Liquidity.** Cash paid toward tuition is gone; a Roth kept intact is *accessible* — you can withdraw **contributions** (not earnings) tax- and penalty-free in an emergency. Preserving the Roth therefore preserves liquidity, another point against redirecting.
- **Flexibility & behavior.** A loan imposes a fixed payment for years; if your early-career income is volatile, that matters. Conversely, being debt-free from day one reduces stress and simplifies life. The 529→Roth rollover rule adds flexibility to modest 529 balances.
- **Cash-flow reality.** If you truly have *no* investable cash, the real choice collapses to **loan (Scenario 1) vs. redirect (Scenario 2)** — and the loan wins decisively because it preserves your Roth. Redirecting is only ever tempting when you forget that Roth room doesn't come back.

---

## 14. What would flip the recommendation

- If your dad's contributions are **over-the-limit money that could never be sheltered anyway**, then "redirecting" them costs no Roth room, and Scenario 2 collapses into "pay cash through a 529" — which is fine. (Confirm this — it's the pivotal fact.)
- If you **can't earn** enough to make Roth contributions in the MAC year (low earned income), your Roth capacity is naturally limited and the whole question shrinks.
- If your expected long-run return is **below your loan rate**, prefer **cash** over the loan (still never redirect).
- If the MAC is **fully covered** by the 529 after all, there's no shortfall and you simply keep maxing the Roth.

---

## 15. Sources

- [Federal Student Aid — Direct Loan interest rates, July 1 2025–June 30 2026](https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2025-05-30/interest-rates-direct-loans-first-disbursed-between-july-1-2025-and-june-30-2026) (Grad Unsubsidized 7.94%, Grad PLUS 8.94%)
- [IRS — 2026 IRA/Roth contribution limit increases to $7,500](https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500)
- [Student loan interest deduction — $2,500 cap and 2025 MAGI phase-outs](https://smartasset.com/taxes/student-loan-interest-deduction)
- [IRS Publication 970 — Tax Benefits for Education (529, education deductions)](https://www.irs.gov/publications/p970)
