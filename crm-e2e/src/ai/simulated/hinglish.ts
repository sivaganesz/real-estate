/**
 * Hinglish → plain English, before the rule readers run (master prompt §12.1: the simulated AI must work on any
 * reasonable input the presenter types). Indian sales teams type commands and enquiries in Roman-script Hindi mixed
 * with English: "3bhk chahiye Whitefield mein 1.2 cr tak", "Priya ka visit kal 11 baje fix karo",
 * "Sanjay ki lead Sneha ko de do", "aaj ke tasks dikhao". Hindi is verb-final, so a few whole-sentence shapes are
 * rewritten first (assign, move stage), then words are swapped. Names, numbers and English words pass through as is.
 * Pure; no React, no store.
 */
import { norm } from './parse'

/** Whole-sentence shapes (verb last in Hindi → verb first in English). Order matters. */
const SHAPES: [RegExp, string][] = [
  // "Sanjay ki lead Sneha ko de do" / "Sanjay ka lead Sneha ko assign karo" → "assign Sanjay's lead to Sneha"
  [/^(.*?)\s+(\S+)\s+ko\s+(?:de\s*do|dedo|de\s*dijiye|dena|assign\s*kar(?:o|\s*do|\s*dijiye)?|transfer\s*kar(?:o|\s*do)?|handover\s*kar(?:o|\s*do)?|bhej\s*do)\b\.?\s*(.*)$/i, 'assign $1 to $2 $3'],
  // "Sanjay ka budget 2 cr kar do" / "Priya ki timeline 3 mahine karo" → "change Sanjay ka budget to 2 cr"
  [/^(.*?)\s+(budget|phone|number|mobile|email|timeline|requirement|location|locality|bhk|configuration)\s+(.+?)\s+(?:kar\s*do|karo|kar\s*dijiye|(?:update|change)\s*kar(?:o|\s*do)?)\b\.?\s*(.*)$/i, 'change $1 $2 to $3 $4'],
  // "Priya ko negotiation mein daalo" / "Priya ko lost mark karo" → "move Priya to negotiation"
  [/^(.*?)\s+ko\s+(.+?)\s+(?:mein|me|main)\s+(?:daalo|dalo|daal\s*do|move\s*kar(?:o|\s*do)?|shift\s*kar(?:o|\s*do)?|kar\s*do|karo)\b\.?\s*(.*)$/i, 'move $1 to $2 $3'],
  [/^(.*?)\s+ko\s+(\S+(?:\s\S+)?)\s+mark\s*kar(?:o|\s*do)\b\.?\s*(.*)$/i, 'mark $1 as $2 $3'],
  // "... fix karo" / "... book kar do" / "... schedule karna hai" → "schedule ..."
  [/^(.*?)\s+(?:fix|book|schedule|set|arrange|plan)\s*(?:kar(?:o|\s*do|\s*dijiye|na\s*hai|\s*dena)|karna)\b\.?\s*(.*)$/i, 'schedule $1 $2'],
  // "... yaad dilana" / "... yaad dila do" → "remind me to ..."
  [/^(.*?)\s+(?:yaad\s*dila(?:na|o|\s*do|\s*dena)|remind\s*kar(?:o|\s*do|na))\b\.?\s*(.*)$/i, 'remind me to $1 $2'],
  // "... dikhao" / "... batao" / "... bata do" → "show ..."
  [/^(.*?)\s+(?:dikhao|dikha\s*do|batao|bata\s*do|bataiye|dikhaiye|list\s*karo)\b\??\s*(.*)$/i, 'show $1 $2'],
]

/** Single words and short phrases. Applied after the shapes. */
const WORDS: [RegExp, string][] = [
  [/\b(?:mera|meri|my)\s+(?:naam|nam)\s+/gi, 'my name is '],
  [/\bparso(?:n)?\b/gi, 'day after tomorrow'],
  [/\b(?:kal|kl)\b/gi, 'tomorrow'],
  [/\baaj(?:\s+ke|\s+ka|\s+ki)?\b/gi, 'today'],
  [/\bsubah\s+(\d{1,2})(?:[:.](\d{2}))?\s*baje\b/gi, 'at $1 am'],
  [/\b(?:shaam|sham|raat)\s+(\d{1,2})(?:[:.](\d{2}))?\s*baje\b/gi, 'at $1 pm'],
  [/\bdopahar\s+(\d{1,2})(?:[:.](\d{2}))?\s*baje\b/gi, 'at $1 pm'],
  [/\b(\d{1,2})[:.](\d{2})\s*baje\b/gi, 'at $1:$2'],
  [/\b(\d{1,2})\s*baje\b/gi, 'at $1'],
  [/\bsubah\b/gi, 'morning'],
  [/\b(?:shaam|sham)\b/gi, 'evening'],
  [/\bdopahar\b/gi, 'afternoon'],
  [/\b(?:agle|agla|next)\s+hafte\b/gi, 'next week'],
  [/\bhafte\b/gi, 'week'],
  [/\bmahine\b/gi, 'months'],
  // "1.2 cr tak" → "up to 1.2 cr"
  [/(\d[\d,.]*\s*(?:cr|crores?|crs?|l|lakhs?|lacs?|lac|k))\s+(?:tak|tk)\b/gi, 'up to $1'],
  [/\b(?:se\s+kam|se\s+neeche)\b/gi, 'or less'],
  [/\b(?:chahiye|chaiye|chahie|chahte\s+hai[n]?|chahta\s+hai|chahti\s+hai|dhundh\s+rahe\s+hai[n]?)\b/gi, 'wants'],
  [/\bke\s+liye\b/gi, 'for'],
  // "Whitefield mein" / "Whitefield me" = "in Whitefield"; "remind me", "call me" stay English
  [/(?<!\b(?:remind|call|tell|give|send|show|help|let|ping|message|text|mail|email)\s)\b(?:mein|me|main)\b(?=\s|$|[,.])/gi, 'in'],
  [/\b(?:wala|wali|wale)\b/gi, ''],
  [/\b(?:ka|ki|ke)\b(?=\s)/gi, "'s"],
  [/\b(?:mere|mera|meri)\b/gi, 'my'],
  [/\b(?:hamare|hamara|hamari)\b/gi, 'our'],
  [/\b(?:kitne|kitni|kitna)\b/gi, 'how many'],
  [/\bkaun\s+(?:sa|se|si)\b/gi, 'which'],
  [/\bkaun\b/gi, 'who'],
  [/\b(?:ghar|makaan|makan)\b/gi, 'house'],
  [/\bzameen\b/gi, 'plot'],
  [/\b(?:biwi|patni|wife\s+bhi)\b/gi, 'wife'],
  [/\b(?:pati)\b/gi, 'husband'],
  [/\b(?:turant|jaldi)\b/gi, 'immediately'],
  [/\b(?:pending|baaki|baki)\b/gi, 'pending'],
  [/\b(?:phone|call)\s+kar(?:o|na|\s*do|na\s*hai)\b/gi, 'call'],
  [/\b(?:milna|mil\s*na|milenge|milte\s+hai[n]?)\b/gi, 'meeting'],
  [/\b(?:hai|hain|tha|thi|hoga|hogi|ji|na|bhi|toh|ko)\b(?=\s|$|[,.?!])/gi, ''],
]

/** True when the text has enough Hindi function words to be Hinglish (keeps plain English untouched). */
export function looksHinglish(text: string): boolean {
  const s = ` ${norm(text).toLowerCase()} `
  return /\s(?:chahiye|chaiye|mein|ka|ki|ke|ko|kal|aaj|parso|baje|karo|kar do|dikhao|batao|tak|wala|wali|kitne|mere|mera|hai|hain|daalo|dalo|de do|dedo|yaad|subah|shaam|dopahar|ghar|liye|kaun|jaldi|turant)[\s,.?!]/.test(s)
}

/** Rewrites Hinglish into the English the readers understand; plain English comes back unchanged (only trimmed). */
export function fromHinglish(text: string): string {
  const s = norm(text)
  if (!looksHinglish(s)) return s
  let out = s
  for (const [re, to] of SHAPES) {
    if (re.test(out)) {
      out = out.replace(re, to)
      break
    }
  }
  for (const [re, to] of WORDS) out = out.replace(re, to)
  return out.replace(/\s+'s\b/g, "'s").replace(/\s{2,}/g, ' ').replace(/\s+([,.?!])/g, '$1').trim()
}

/**
 * Only the word swaps (no sentence reshaping), for pasted enquiries and appointment notes: "kal 11 baje" → "tomorrow
 * at 11", "1.2 cr tak" → "up to 1.2 cr", "mera naam Rahul" → "my name is Rahul". Plain English comes back unchanged.
 */
export function hinglishWords(text: string): string {
  if (!looksHinglish(text)) return text
  let out = text
  for (const [re, to] of WORDS) out = out.replace(re, to)
  return out.replace(/\s+'s\b/g, "'s").replace(/[ \t]{2,}/g, ' ')
}
