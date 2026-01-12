// server/scripts/backfillStages.js
import prisma from '../prismaClient.js';

const ROUND_ORDER = ['Grupa', 'Ćwierćfinał', 'Półfinał', 'Finał'];

function guessStage(round) {
  if (!round) return 'group';
  return round.startsWith('Grupa') ? 'group' : 'knockout';
}

function guessRoundOrder(round) {
  if (!round) return null;
  const idx = ROUND_ORDER.findIndex(prefix => round.startsWith(prefix));
  return idx === -1 ? null : idx + 1; // 1..4
}

async function main() {
  const matches = await prisma.match.findMany({ select: { id: true, round: true }});
  for (const m of matches) {
    const stage = guessStage(m.round);
    const ro = guessRoundOrder(m.round);
    await prisma.match.update({
      where: { id: m.id },
      data: { stage, roundOrder: ro }
    });
  }
  console.log(`OK: zaktualizowano ${matches.length} meczów`);
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
