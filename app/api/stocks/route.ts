import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const COOKIE_NAME = 'memo_auth';

const MAX_INITIAL_INVESTMENT = 100_000_000; // 1억원
const MAX_INPUT_AMOUNT = 1_000_000_000; // 10억원

function createSessionToken() {
  return createHmac('sha256', process.env.SUPABASE_SECRET_KEY!)
    .update('my-memo-authenticated')
    .digest('hex');
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);

  if (!cookie?.value) {
    return false;
  }

  const expected = createSessionToken();

  const a = Buffer.from(cookie.value);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

function parseInteger(
  value: unknown,
  min: number,
  max: number
) {
  const text = String(value ?? '')
    .replace(/,/g, '')
    .trim();

  if (!/^-?\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);

  if (!Number.isSafeInteger(number)) {
    return null;
  }

  if (number < min || number > max) {
    return null;
  }

  return number;
}

function parseRate(value: unknown) {
  const text = String(value ?? '').trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (number <= -100) {
    return null;
  }

  return Math.round(number * 100) / 100;
}

function getRoundDate(roundNo: number) {
  const date = new Date(
    Date.UTC(2025, 8 + roundNo - 1, 1)
  );

  return date.toISOString().slice(0, 10);
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: '인증이 필요합니다.' },
      { status: 401 }
    );
  }

  const [settingsResult, recordsResult] =
    await Promise.all([
      supabaseAdmin
        .from('stock_settings')
        .select(
          'id, initial_investment, monthly_return_rate, display_rounds'
        )
        .eq('id', 1)
        .single(),

      supabaseAdmin
        .from('stock_records')
        .select(
          'id, round_no, record_date, profit, deposit, withdrawal, updated_at'
        )
        .order('round_no', {
          ascending: true,
        }),
    ]);

  if (settingsResult.error) {
    console.error(settingsResult.error);

    return Response.json(
      { message: '설정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  if (recordsResult.error) {
    console.error(recordsResult.error);

    return Response.json(
      { message: '주식 기록을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  return Response.json({
    settings: settingsResult.data,
    records: recordsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { message: '인증이 필요합니다.' },
      { status: 401 }
    );
  }

  const body = await request.json();

  /*
   * 설정 저장
   */
  if (body.type === 'settings') {
    const initialInvestment = parseInteger(
      body.initialInvestment,
      0,
      MAX_INITIAL_INVESTMENT
    );

    const monthlyReturnRate = parseRate(
      body.monthlyReturnRate
    );

    const displayRounds = parseInteger(
      body.displayRounds,
      1,
      999
    );

    if (
      initialInvestment === null ||
      monthlyReturnRate === null ||
      displayRounds === null
    ) {
      return Response.json(
        {
          message:
            '설정값을 확인해주세요. 초기투자금은 1억원 이하, 월간수익률은 소수점 2자리까지, 회차는 1~999회입니다.',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('stock_settings')
      .upsert(
        {
          id: 1,
          initial_investment: initialInvestment,
          monthly_return_rate: monthlyReturnRate,
          display_rounds: displayRounds,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )
      .select(
        'id, initial_investment, monthly_return_rate, display_rounds'
      )
      .single();

    if (error) {
      console.error(error);

      return Response.json(
        { message: '설정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    return Response.json({
      settings: data,
    });
  }

  /*
   * 회차 기록 저장
   */
  if (body.type === 'record') {
    const roundNo = parseInteger(
      body.roundNo,
      1,
      999
    );

    const profit = parseInteger(
      body.profit,
      -MAX_INPUT_AMOUNT,
      MAX_INPUT_AMOUNT
    );

    const deposit = parseInteger(
      body.deposit,
      -MAX_INPUT_AMOUNT,
      MAX_INPUT_AMOUNT
    );

    const withdrawal = parseInteger(
      body.withdrawal,
      -MAX_INPUT_AMOUNT,
      MAX_INPUT_AMOUNT
    );

    if (
      roundNo === null ||
      profit === null ||
      deposit === null ||
      withdrawal === null
    ) {
      return Response.json(
        {
          message:
            '수익·입금·출금은 각각 -10억원부터 10억원까지 입력할 수 있습니다.',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('stock_records')
      .upsert(
        {
          round_no: roundNo,
          record_date: getRoundDate(roundNo),
          profit,
          deposit,
          withdrawal,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'round_no',
        }
      )
      .select(
        'id, round_no, record_date, profit, deposit, withdrawal, updated_at'
      )
      .single();

    if (error) {
      console.error(error);

      return Response.json(
        { message: '회차 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    return Response.json({
      record: data,
    });
  }

  return Response.json(
    { message: '잘못된 요청입니다.' },
    { status: 400 }
  );
}