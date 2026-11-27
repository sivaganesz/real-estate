/** Varied phrasings of every master prompt §12.5 request (XAI-10): each must reach its intent, never "unknown". */
import { describe, expect, it } from 'vitest'
import { detectIntent } from './intents'
import { fromHinglish } from './hinglish'
const cases: Record<string, string[]> = {
 todayTasks: ["show today's pending tasks","what tasks are pending for me today","list my pending tasks","tasks due today","what do I have pending today","pending work today","show my todo for today","any tasks left today","what's left to do today","pending tasks"],
 performance: ["summarize my performance","how did I do this month","give me my sales summary","show my stats","how am I performing","my performance this week","review my month","what are my numbers this month"],
 teamPerformance: ["summarize my team's performance","how is my team performing","which executive has the best conversion?","team summary","show team stats","how are my executives doing","who is the top performer","compare my executives","team report this month"],
 priorityLeads: ["find my highest-priority leads","which leads are hot","what should I focus on","who are my best leads","show hot leads","top priority leads","which leads need my attention first","most promising leads","leads I should prioritize"],
 followUpLeads: ["which leads need follow-up","which leads have not been contacted?","leads with no follow-up scheduled","leads without a follow-up","who needs a follow up","overdue follow-ups","leads I forgot to follow up","leads going cold","which leads are waiting for a callback","leads not touched in a week"],
 findMatches: ["show properties within Ananya's budget","what fits Ananya budget?","which properties suit Ananya Iyer?","find matches for Ananya","find matching properties for Ananya Iyer","properties under Ananya's budget","recommend properties for Ananya","show me homes Ananya can afford","best properties for Ananya"],
 conversions: ["which leads are potential conversions","which deals are close to closing?","who is likely to book","show potential conversions","leads likely to convert","deals about to close","which leads will close this month","hot deals near closure"],
 todayAppointments: ["summarize today's appointments","show today's visits","what meetings do I have today","what's my schedule today","any site visits today","today's calendar","list appointments for today","my appointments today"],
 createAppointment: ["schedule a site visit for Priya tomorrow at 11 am","book a visit for Priya Saturday 4pm","arrange site visit with Priya on Friday","set up a meeting with Priya tomorrow 3pm","fix a visit for Priya tomorrow"],
 createTask: ["schedule a follow-up for Priya tomorrow at 5 pm","create follow-up for Priya at 5 PM tomorrow","set a follow up with Priya on Friday","remind me to call Priya tomorrow","add a follow-up for Priya next week","Priya ko kal shaam 5 baje call karna hai","Priya ko kal call karna hai","follow-up Priya tomorrow 5pm"],
 assignLead: ["assign Priya to Arjun","assign lead Priya Sharma to Arjun Mehta","give Priya to Arjun","hand over Priya to Arjun","transfer Priya's lead to Arjun","allocate Priya Sharma to Arjun","assign Priya to Sneha tomorrow","Priya ko Arjun ko assign karo","Priya Arjun ko de do"],
}
describe('master prompt §12.5 requests are understood in at least four phrasings each (XAI-10)', () => {
  for (const [intent, phrasings] of Object.entries(cases)) {
    describe(intent, () => {
      it.each(phrasings)('%s', (text) => {
        expect(detectIntent(fromHinglish(text))).toBe(intent)
      })
    })
  }
})
