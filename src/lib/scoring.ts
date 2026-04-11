import { PriceItem, PromoItem } from './claude'

export interface ScoreBreakdown {
  pricing_competitiveness: number   // 0–60
  promotional_activity: number      // 0–40
  total: number                     // 1–100
  pricing_notes: string
  promo_notes: string
}

/**
 * Market Positioning Score (1–100)
 * Formula: pricing competitiveness (60%) + promotional activity frequency (40%)
 *
 * NOTE: Score is based ONLY on observable pricing and promotional activity.
 * It does NOT reflect revenue, customer volume, foot traffic, or review data.
 */
export function calculateScore(
  parsedPricing: PriceItem[],
  parsedPromos: PromoItem[],
  pricingPosition: string,
  allCompetitorPricing: PriceItem[][],
): ScoreBreakdown {
  // --- Pricing Competitiveness (0–60) ---
  // Higher score = more competitive pricing (not necessarily cheapest)
  let pricingScore = 30 // neutral default
  let pricingNotes = 'Pricing data limited'

  if (parsedPricing.length > 0) {
    const myPrices = parsedPricing.map(p => p.price_numeric).filter((n): n is number => n !== null)
    const allPrices = allCompetitorPricing.flat().map(p => p.price_numeric).filter((n): n is number => n !== null)

    if (myPrices.length > 0 && allPrices.length > 0) {
      const myAvg = myPrices.reduce((a, b) => a + b, 0) / myPrices.length
      const marketAvg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length

      if (pricingPosition === 'below_market') {
        pricingScore = 50
        pricingNotes = `Priced below market average (${formatPrice(myAvg)} vs ${formatPrice(marketAvg)} market avg) — strong value positioning`
      } else if (pricingPosition === 'at_market') {
        pricingScore = 35
        pricingNotes = `Priced at market average (~${formatPrice(marketAvg)}) — neutral competitive positioning`
      } else {
        pricingScore = 20
        pricingNotes = `Priced above market average (${formatPrice(myAvg)} vs ${formatPrice(marketAvg)} market avg) — premium positioning`
      }
    } else if (parsedPricing.length > 0) {
      pricingScore = 35
      pricingNotes = `${parsedPricing.length} service price(s) detected — market comparison limited`
    }
  }

  // --- Promotional Activity (0–40) ---
  // More promo types = higher promo score (capped at 40)
  let promoScore = 0
  let promoNotes = 'No promotions detected'

  if (parsedPromos.length > 0) {
    promoScore = Math.min(40, parsedPromos.length * 12)
    promoNotes = `${parsedPromos.length} promotion type(s) detected: ${parsedPromos.map(p => p.type).join(', ')}`
  }

  const total = Math.max(1, Math.min(100, pricingScore + promoScore))

  return {
    pricing_competitiveness: pricingScore,
    promotional_activity: promoScore,
    total,
    pricing_notes: pricingNotes,
    promo_notes: promoNotes,
  }
}

function formatPrice(n: number): string {
  return `£${n.toFixed(0)}`
}
