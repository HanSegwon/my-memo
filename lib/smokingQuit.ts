export type QuitMilestone = { afterMs: number; benefit: string };

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const year = 365 * day;

export const QUIT_MILESTONES: QuitMilestone[] = [
  { afterMs: 20 * minute, benefit: '맥박이 정상 수준으로 돌아오기 시작해요.' },
  { afterMs: 8 * hour, benefit: '혈중 산소가 회복되고 일산화탄소가 절반가량 줄어요.' },
  { afterMs: 48 * hour, benefit: '미각과 후각이 좋아지기 시작해요.' },
  { afterMs: 72 * hour, benefit: '기관지가 이완되어 숨쉬기가 한결 편해질 수 있어요.' },
  { afterMs: 14 * day, benefit: '혈액순환이 나아지기 시작해요.' },
  { afterMs: 90 * day, benefit: '기침과 숨참이 줄고 폐 기능이 회복되기 시작해요.' },
  { afterMs: year, benefit: '심장질환 위험이 눈에 띄게 낮아져요.' },
  { afterMs: 5 * year, benefit: '뇌졸중 위험이 계속 낮아져요.' },
  { afterMs: 10 * year, benefit: '폐암을 포함한 여러 암의 위험이 더 낮아져요.' },
  { afterMs: 15 * year, benefit: '관상동맥 질환 위험이 비흡연자 수준에 가까워져요.' },
  { afterMs: 20 * year, benefit: '장기적인 건강 회복을 꾸준히 이어가고 있어요.' },
];

export const QUIT_MESSAGES: Array<{ afterMs: number; text: string }> = [
  { afterMs: 0, text: '금연을 시작한 지금, 몸의 회복도 시작됐어요.' },
  { afterMs: 0, text: '오늘의 결심이 내일의 건강을 만들어요. 잘하고 있어요!' },
  { afterMs: 0, text: '한 번에 하루씩, 지금 이 순간을 잘 넘기고 있어요.' },
  { afterMs: 0, text: '담배 생각은 파도처럼 지나가요. 잠깐 다른 일에 집중해봐요.' },
  { afterMs: 0, text: '완벽할 필요 없어요. 다시 선택하는 매 순간이 중요해요.' },
  { afterMs: 20 * minute, text: '20분을 지났어요. 맥박이 정상 수준을 찾아가기 시작합니다.' },
  { afterMs: 20 * minute, text: '첫 고비를 넘겼어요. 몸은 벌써 변화를 시작했어요.' },
  { afterMs: 8 * hour, text: '8시간을 지켰어요. 혈중 산소가 회복되고 있어요.' },
  { afterMs: 8 * hour, text: '오늘도 잘 견디고 있어요. 작은 성취를 꼭 기억해요.' },
  { afterMs: 48 * hour, text: '이틀을 지났어요. 미각과 후각이 조금씩 좋아질 수 있어요.' },
  { afterMs: 48 * hour, text: '지금의 선택이 숨 쉬기 편한 내일을 쌓아가고 있어요.' },
  { afterMs: 48 * hour, text: '힘든 순간에는 물 한 잔과 천천히 하는 호흡이 도움이 될 수 있어요.' },
  { afterMs: 72 * hour, text: '3일을 지켰어요. 기관지가 이완되며 숨쉬기가 편해질 수 있어요.' },
  { afterMs: 72 * hour, text: '여기까지 온 자신을 칭찬해주세요. 계속 함께 가요!' },
  { afterMs: 14 * day, text: '2주를 지났어요. 혈액순환이 나아지기 시작하는 시기예요.' },
  { afterMs: 14 * day, text: '2주 동안 쌓아온 선택은 큰 변화예요. 정말 잘하고 있어요.' },
  { afterMs: 90 * day, text: '3개월을 향해 가고 있어요. 기침과 숨참이 줄어들 수 있어요.' },
  { afterMs: 90 * day, text: '금연은 매일의 건강을 위한 투자예요. 오늘도 이어가요.' },
  { afterMs: year, text: '1년의 여정에 가까워지고 있어요. 꾸준함이 건강을 바꿉니다.' },
  { afterMs: 5 * year, text: '오래 이어온 금연은 큰 선물이에요. 스스로를 자랑스러워하세요.' },
];

export function getQuitDuration(startedAt: string, now = Date.now()) {
  return Math.max(0, now - new Date(startedAt).getTime());
}

export function formatQuitTimer(durationMs: number) {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(days).padStart(2, '0')}일 ${String(hours).padStart(2, '0')}시간 ${String(minutes).padStart(2, '0')}분 ${String(seconds).padStart(2, '0')}초`;
}

export function getNextQuitSummary(startedAt: string, now = Date.now()) {
  const started = new Date(startedAt).getTime();
  const next = QUIT_MILESTONES.find((milestone) => started + milestone.afterMs > now);
  if (!next) return '금연을 이어가고 있어요. 꾸준한 금연이 건강에 도움이 됩니다.';

  const remainingMinutes = Math.max(1, Math.ceil((started + next.afterMs - now) / minute));
  const days = Math.floor(remainingMinutes / (24 * 60));
  const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
  const minutes = remainingMinutes % 60;
  const remaining = [
    days > 0 ? `${days}일` : '',
    hours > 0 ? `${hours}시간` : '',
    minutes > 0 ? `${minutes}분` : '',
  ].filter(Boolean).join(' ');
  return `${remaining}만 더 참으면 ${next.benefit}`;
}

export function getRandomQuitMessage(durationMs: number) {
  const applicable = QUIT_MESSAGES.filter((message) => message.afterMs <= durationMs);
  return applicable[Math.floor(Math.random() * applicable.length)]?.text ?? QUIT_MESSAGES[0].text;
}
