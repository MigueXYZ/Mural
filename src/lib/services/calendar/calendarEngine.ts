// File: src/lib/services/calendar/calendarEngine.ts

import type {
  CustomCalendarConfig,
  CalendarMonth,
  LeapYearRule,
  MoonPhaseConfig,
  MoonPhaseResult,
  MoonPhaseType,
} from '../../types';

// ---------------------------------------------------------------------------
// 1. Math & Leap Year Logic
// ---------------------------------------------------------------------------

/**
 * Checks if a given year is a leap year according to the calendar rule.
 */
export function isLeapYear(year: number, config: CustomCalendarConfig): boolean {
  const rule = config.leapYearRule;
  if (!rule || !rule.enabled || rule.intervalYears <= 0) return false;
  return year % rule.intervalYears === 0;
}

/**
 * Returns the exact number of days in a specific month, accounting for leap years.
 */
export function getDaysInMonth(year: number, monthIndex: number, config: CustomCalendarConfig): number {
  if (!config.months || config.months.length === 0) return 30;
  const clampedIndex = Math.max(0, Math.min(monthIndex, config.months.length - 1));
  const baseDays = config.months[clampedIndex].days;

  const rule = config.leapYearRule;
  if (rule && rule.enabled && rule.monthIndex === clampedIndex && isLeapYear(year, config)) {
    return baseDays + (rule.extraDays || 1);
  }

  return baseDays;
}

/**
 * Returns the total number of days in a given year.
 */
export function getDaysInYear(year: number, config: CustomCalendarConfig): number {
  if (!config.months || config.months.length === 0) return 360;
  let total = 0;
  for (let m = 0; m < config.months.length; m++) {
    total += getDaysInMonth(year, m, config);
  }
  return total;
}

/**
 * Computes the total cumulative day index starting from Year 1, Month 0, Day 1 (0-indexed).
 */
export function calculateTotalDays(
  year: number,
  monthIndex: number,
  day: number,
  config: CustomCalendarConfig
): number {
  let totalDays = 0;

  // 1. Full years elapsed (assuming standard year 1 base)
  const baseYear = 1;
  if (year >= baseYear) {
    for (let y = baseYear; y < year; y++) {
      totalDays += getDaysInYear(y, config);
    }
  } else {
    for (let y = year; y < baseYear; y++) {
      totalDays -= getDaysInYear(y, config);
    }
  }

  // 2. Full months elapsed in current year
  const clampedMonth = Math.max(0, Math.min(monthIndex, config.months.length - 1));
  for (let m = 0; m < clampedMonth; m++) {
    totalDays += getDaysInMonth(year, m, config);
  }

  // 3. Days elapsed in current month
  totalDays += Math.max(0, day - 1);

  return totalDays;
}

/**
 * Calculates Year, MonthIndex, and Day from a total cumulative day count.
 */
export function calculateDateFromTotalDays(
  totalDays: number,
  config: CustomCalendarConfig
): { year: number; monthIndex: number; day: number } {
  let remainingDays = totalDays;
  let currentYear = 1;

  if (remainingDays >= 0) {
    while (true) {
      const yearDays = getDaysInYear(currentYear, config);
      if (remainingDays >= yearDays) {
        remainingDays -= yearDays;
        currentYear++;
      } else {
        break;
      }
    }
  } else {
    while (remainingDays < 0) {
      currentYear--;
      const yearDays = getDaysInYear(currentYear, config);
      remainingDays += yearDays;
    }
  }

  let currentMonthIndex = 0;
  for (let m = 0; m < config.months.length; m++) {
    const monthDays = getDaysInMonth(currentYear, m, config);
    if (remainingDays >= monthDays && m < config.months.length - 1) {
      remainingDays -= monthDays;
      currentMonthIndex++;
    } else {
      break;
    }
  }

  const currentDay = remainingDays + 1;

  return {
    year: currentYear,
    monthIndex: currentMonthIndex,
    day: currentDay,
  };
}

// ---------------------------------------------------------------------------
// 2. Weekdays & Day-of-Week
// ---------------------------------------------------------------------------

/**
 * Computes the day of the week for a given date.
 */
export function getDayOfWeek(
  year: number,
  monthIndex: number,
  day: number,
  config: CustomCalendarConfig
): { index: number; name: string } {
  const weekdays = config.weekdays && config.weekdays.length > 0 ? config.weekdays : ['Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 5', 'Dia 6', 'Dia 7'];
  const totalDays = calculateTotalDays(year, monthIndex, day, config);
  const weekdayIndex = ((totalDays % weekdays.length) + weekdays.length) % weekdays.length;
  return {
    index: weekdayIndex,
    name: weekdays[weekdayIndex],
  };
}

// ---------------------------------------------------------------------------
// 3. Moon Phase Calculations
// ---------------------------------------------------------------------------

export const MOON_PHASE_INFO: Record<
  MoonPhaseType,
  { name: string; icon: string; minProgress: number; maxProgress: number; illumination: number }
> = {
  new_moon: { name: 'Lua Nova', icon: '🌑', minProgress: 0.94, maxProgress: 0.06, illumination: 0 },
  waxing_crescent: { name: 'Crescente Côncava', icon: '🌒', minProgress: 0.06, maxProgress: 0.19, illumination: 25 },
  first_quarter: { name: 'Quarto Crescente', icon: '🌓', minProgress: 0.19, maxProgress: 0.31, illumination: 50 },
  waxing_gibbous: { name: 'Crescente Gibosa', icon: '🌔', minProgress: 0.31, maxProgress: 0.44, illumination: 75 },
  full_moon: { name: 'Lua Cheia', icon: '🌕', minProgress: 0.44, maxProgress: 0.56, illumination: 100 },
  waning_gibbous: { name: 'Minguante Gibosa', icon: '🌖', minProgress: 0.56, maxProgress: 0.69, illumination: 75 },
  last_quarter: { name: 'Quarto Minguante', icon: '🌗', minProgress: 0.69, maxProgress: 0.81, illumination: 50 },
  waning_crescent: { name: 'Minguante Côncava', icon: '🌘', minProgress: 0.81, maxProgress: 0.94, illumination: 25 },
};

/**
 * Calculates current moon phases for all configured celestial moons.
 */
export function getMoonPhases(
  year: number,
  monthIndex: number,
  day: number,
  config: CustomCalendarConfig
): MoonPhaseResult[] {
  if (!config.moons || config.moons.length === 0) return [];

  const totalDays = calculateTotalDays(year, monthIndex, day, config);

  return config.moons.map((moon) => {
    const cycle = moon.cycleDays > 0 ? moon.cycleDays : 28;
    const offset = moon.startingPhaseDay || 0;
    const normalizedProgress = (((totalDays + offset) % cycle) + cycle) % cycle / cycle;

    let phaseType: MoonPhaseType = 'new_moon';
    if (normalizedProgress >= 0.06 && normalizedProgress < 0.19) {
      phaseType = 'waxing_crescent';
    } else if (normalizedProgress >= 0.19 && normalizedProgress < 0.31) {
      phaseType = 'first_quarter';
    } else if (normalizedProgress >= 0.31 && normalizedProgress < 0.44) {
      phaseType = 'waxing_gibbous';
    } else if (normalizedProgress >= 0.44 && normalizedProgress < 0.56) {
      phaseType = 'full_moon';
    } else if (normalizedProgress >= 0.56 && normalizedProgress < 0.69) {
      phaseType = 'waning_gibbous';
    } else if (normalizedProgress >= 0.69 && normalizedProgress < 0.81) {
      phaseType = 'last_quarter';
    } else if (normalizedProgress >= 0.81 && normalizedProgress < 0.94) {
      phaseType = 'waning_crescent';
    } else {
      phaseType = 'new_moon';
    }

    const info = MOON_PHASE_INFO[phaseType];
    const illumination = Math.round((1 - Math.cos(normalizedProgress * 2 * Math.PI)) * 50);

    return {
      moon,
      phase: phaseType,
      phaseName: info.name,
      phaseIcon: info.icon,
      illuminationPercent: illumination,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Time Advancement & Stepping
// ---------------------------------------------------------------------------

/**
 * Advances calendar by N days (supports positive and negative steps).
 */
export function advanceDays(config: CustomCalendarConfig, days: number): CustomCalendarConfig {
  const currentTotal = calculateTotalDays(config.currentYear, config.currentMonthIndex, config.currentDay, config);
  const newTotal = currentTotal + days;
  const newDate = calculateDateFromTotalDays(newTotal, config);

  return {
    ...config,
    currentYear: newDate.year,
    currentMonthIndex: newDate.monthIndex,
    currentDay: newDate.day,
  };
}

/**
 * Advances calendar by N months.
 */
export function advanceMonths(config: CustomCalendarConfig, months: number): CustomCalendarConfig {
  if (!config.months || config.months.length === 0) return config;

  let totalMonths = config.currentYear * config.months.length + config.currentMonthIndex + months;
  let newYear = Math.floor(totalMonths / config.months.length);
  let newMonthIndex = totalMonths % config.months.length;

  if (newMonthIndex < 0) {
    newMonthIndex += config.months.length;
    newYear -= 1;
  }

  const maxDays = getDaysInMonth(newYear, newMonthIndex, config);
  const newDay = Math.min(config.currentDay, maxDays);

  return {
    ...config,
    currentYear: newYear,
    currentMonthIndex: newMonthIndex,
    currentDay: newDay,
  };
}

/**
 * Advances calendar by N years.
 */
export function advanceYears(config: CustomCalendarConfig, years: number): CustomCalendarConfig {
  const newYear = config.currentYear + years;
  const maxDays = getDaysInMonth(newYear, config.currentMonthIndex, config);
  const newDay = Math.min(config.currentDay, maxDays);

  return {
    ...config,
    currentYear: newYear,
    currentDay: newDay,
  };
}

// ---------------------------------------------------------------------------
// 5. Date Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a calendar date into a rich, human-readable string for the campaign.
 */
export function formatDate(
  config: CustomCalendarConfig,
  customDate?: { year: number; monthIndex: number; day: number }
): string {
  const year = customDate ? customDate.year : config.currentYear;
  const monthIndex = customDate ? customDate.monthIndex : config.currentMonthIndex;
  const day = customDate ? customDate.day : config.currentDay;

  const month = config.months && config.months[monthIndex] ? config.months[monthIndex].name : `Mês ${monthIndex + 1}`;
  const prefix = config.yearPrefix ? `${config.yearPrefix} ` : '';
  const suffix = config.yearSuffix ? ` ${config.yearSuffix}` : '';

  return `${day} de ${month}, ${prefix}${year}${suffix}`.trim();
}

// ---------------------------------------------------------------------------
// 6. Preconfigured Templates & Presets
// ---------------------------------------------------------------------------

export const HARPTOS_PRESET: CustomCalendarConfig = {
  id: 'preset-harptos',
  name: 'Calendário de Harptos (D&D 5e / Forgotten Realms)',
  description: '12 meses de 30 dias com 5 festivais solares intercalares e Shieldmeet nos anos bissextos.',
  weekdays: ['Primeiro Dia', 'Segundo Dia', 'Terceiro Dia', 'Quarto Dia', 'Quinto Dia', 'Sexto Dia', 'Sétimo Dia', 'Oitavo Dia', 'Nono Dia', 'Dia da Vigília'],
  months: [
    { id: 'm1', name: 'Hammer (Martelo Longevo)', days: 30, season: 'Inverno' },
    { id: 'm2', name: 'Alturiak (A Garra do Inverno)', days: 30, season: 'Inverno' },
    { id: 'm3', name: 'Ches (O Descongelamento)', days: 30, season: 'Primavera' },
    { id: 'm4', name: 'Tarsakh (As Tempestades)', days: 30, season: 'Primavera' },
    { id: 'm5', name: 'Mirtul (O Degelo)', days: 30, season: 'Primavera' },
    { id: 'm6', name: 'Kythorn (O Tempo das Flores)', days: 30, season: 'Verão' },
    { id: 'm7', name: 'Flamerule (A Cimeira do Sol)', days: 30, season: 'Verão' },
    { id: 'm8', name: 'Eleasis (A Queimada do Sol)', days: 30, season: 'Verão' },
    { id: 'm9', name: 'Eleint (O Desvanecer)', days: 30, season: 'Outono' },
    { id: 'm10', name: 'Marpenoth (A Queda das Folhas)', days: 30, season: 'Outono' },
    { id: 'm11', name: 'Uktar (A Murcha)', days: 30, season: 'Outono' },
    { id: 'm12', name: 'Nightal (O Retirar)', days: 30, season: 'Inverno' },
  ],
  yearPrefix: 'Ano',
  yearSuffix: 'DR (Cômputo dos Vales)',
  currentYear: 1492,
  currentMonthIndex: 3,
  currentDay: 14,
  leapYearRule: {
    enabled: true,
    intervalYears: 4,
    monthIndex: 6, // Flamerule receives Shieldmeet
    extraDays: 1,
  },
  moons: [
    {
      id: 'moon-selune',
      name: 'Selûne',
      cycleDays: 30.43,
      startingPhaseDay: 0,
      color: '#e2e8f0',
    },
  ],
  holidays: [
    { id: 'h1', name: 'Midwinter (Pleno Inverno)', monthIndex: 0, day: 30, description: 'Celebração solene da metade do inverno.' },
    { id: 'h2', name: 'Greengrass (Relva Verde)', monthIndex: 3, day: 30, description: 'Boas-vindas à primavera com flores e canções.' },
    { id: 'h3', name: 'Midsummer (Pleno Verão)', monthIndex: 6, day: 30, description: 'Noite de banquetes, amor e festas sob as estrelas.' },
    { id: 'h4', name: 'Highharvestide (Grande Colheita)', monthIndex: 8, day: 30, description: 'Dia de ação de graças pelas colheitas de outono.' },
    { id: 'h5', name: 'Feast of the Moon (Festa da Lua)', monthIndex: 10, day: 30, description: 'Homenagem aos ancestrais e mortos em batalha.' },
  ],
};

export const GREGORIAN_PRESET: CustomCalendarConfig = {
  id: 'preset-gregorian',
  name: 'Calendário Gregoriano Padrão',
  description: 'Calendário solar comum de 12 meses (365/366 dias) com 7 dias por semana.',
  weekdays: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'],
  months: [
    { id: 'm1', name: 'Janeiro', days: 31, season: 'Inverno' },
    { id: 'm2', name: 'Fevereiro', days: 28, season: 'Inverno' },
    { id: 'm3', name: 'Março', days: 31, season: 'Primavera' },
    { id: 'm4', name: 'Abril', days: 30, season: 'Primavera' },
    { id: 'm5', name: 'Maio', days: 31, season: 'Primavera' },
    { id: 'm6', name: 'Junho', days: 30, season: 'Verão' },
    { id: 'm7', name: 'Julho', days: 31, season: 'Verão' },
    { id: 'm8', name: 'Agosto', days: 31, season: 'Verão' },
    { id: 'm9', name: 'Setembro', days: 30, season: 'Outono' },
    { id: 'm10', name: 'Outubro', days: 31, season: 'Outono' },
    { id: 'm11', name: 'Novembro', days: 30, season: 'Outono' },
    { id: 'm12', name: 'Dezembro', days: 31, season: 'Inverno' },
  ],
  yearPrefix: 'Ano',
  yearSuffix: '',
  currentYear: 2026,
  currentMonthIndex: 8,
  currentDay: 1,
  leapYearRule: {
    enabled: true,
    intervalYears: 4,
    monthIndex: 1, // Fevereiro
    extraDays: 1,
  },
  moons: [
    {
      id: 'moon-earth',
      name: 'Lua',
      cycleDays: 29.53,
      startingPhaseDay: 3,
      color: '#f1f5f9',
    },
  ],
  holidays: [
    { id: 'h-ny', name: 'Ano Novo', monthIndex: 0, day: 1, description: 'Primeiro dia do ano civil.' },
    { id: 'h-solstice', name: 'Solstício de Verão', monthIndex: 5, day: 21, description: 'Dia mais longo do ano.' },
  ],
};

export const ARTON_PRESET: CustomCalendarConfig = {
  id: 'preset-arton',
  name: 'Calendário de Arton (Tormenta 20)',
  description: '12 meses consagrados aos Deuses do Panteão de Arton.',
  weekdays: ['Primeiro-dia', 'Segundo-dia', 'Terceiro-dia', 'Quarto-dia', 'Quinto-dia', 'Sexto-dia', 'Sétimo-dia'],
  months: [
    { id: 'm1', name: 'Valkaria (A Ambição)', days: 30, season: 'Primavera' },
    { id: 'm2', name: 'Khalmyr (A Justiça)', days: 30, season: 'Primavera' },
    { id: 'm3', name: 'Lena (A Vida)', days: 30, season: 'Primavera' },
    { id: 'm4', name: 'Azgher (O Sol)', days: 30, season: 'Verão' },
    { id: 'm5', name: 'Thyatis (A Profecia)', days: 30, season: 'Verão' },
    { id: 'm6', name: 'Tanna-Toh (O Conhecimento)', days: 30, season: 'Verão' },
    { id: 'm7', name: 'Marah (A Paz)', days: 30, season: 'Outono' },
    { id: 'm8', name: 'Allihanna (A Natureza)', days: 30, season: 'Outono' },
    { id: 'm9', name: 'Hyninn (A Astúcia)', days: 30, season: 'Outono' },
    { id: 'm10', name: 'Wynna (A Magia)', days: 30, season: 'Inverno' },
    { id: 'm11', name: 'Keenn / Arsenal (A Guerra)', days: 30, season: 'Inverno' },
    { id: 'm12', name: 'Tenebra (A Noite)', days: 30, season: 'Inverno' },
  ],
  yearPrefix: 'Ano',
  yearSuffix: 'de Arton',
  currentYear: 1410,
  currentMonthIndex: 0,
  currentDay: 1,
  leapYearRule: {
    enabled: false,
    intervalYears: 0,
    monthIndex: 0,
    extraDays: 0,
  },
  moons: [
    {
      id: 'moon-tenebra',
      name: 'Tenebra',
      cycleDays: 28,
      startingPhaseDay: 0,
      color: '#c084fc',
    },
  ],
};

export const LUNAR_13_PRESET: CustomCalendarConfig = {
  id: 'preset-lunar13',
  name: 'Calendário Lunar Primordial (13 Meses de 28 Dias)',
  description: '13 meses harmoniosos de exatamente 28 dias cada (4 semanas perfeitas), com 2 luas celestes.',
  weekdays: ['Sol', 'Lua', 'Marte', 'Mercúrio', 'Júpiter', 'Vénus', 'Saturno'],
  months: [
    { id: 'm1', name: 'Bruma Nascente', days: 28, season: 'Inverno' },
    { id: 'm2', name: 'Gelo Fino', days: 28, season: 'Inverno' },
    { id: 'm3', name: 'Despertar Verde', days: 28, season: 'Primavera' },
    { id: 'm4', name: 'Floração', days: 28, season: 'Primavera' },
    { id: 'm5', name: 'Vento Suave', days: 28, season: 'Primavera' },
    { id: 'm6', name: 'Sol Alto', days: 28, season: 'Verão' },
    { id: 'm7', name: 'Cima do Fogo', days: 28, season: 'Verão' },
    { id: 'm8', name: 'Cinza Dourada', days: 28, season: 'Verão' },
    { id: 'm9', name: 'Colheita Farta', days: 28, season: 'Outono' },
    { id: 'm10', name: 'Folhas Vermelhas', days: 28, season: 'Outono' },
    { id: 'm11', name: 'Névoa Fria', days: 28, season: 'Outono' },
    { id: 'm12', name: 'Noite Longa', days: 28, season: 'Inverno' },
    { id: 'm13', name: 'Dia do Silêncio', days: 28, season: 'Inverno' },
  ],
  yearPrefix: 'Ciclo',
  yearSuffix: 'da Harmonia',
  currentYear: 780,
  currentMonthIndex: 2,
  currentDay: 1,
  leapYearRule: {
    enabled: true,
    intervalYears: 4,
    monthIndex: 12,
    extraDays: 1,
  },
  moons: [
    {
      id: 'moon-primary',
      name: 'Lua Branca (Aenya)',
      cycleDays: 28,
      startingPhaseDay: 0,
      color: '#e2e8f0',
    },
    {
      id: 'moon-secondary',
      name: 'Lua Vermelha (Morgath)',
      cycleDays: 33,
      startingPhaseDay: 12,
      color: '#f87171',
    },
  ],
};

export const AERTHYS_PRESET: CustomCalendarConfig = {
  id: 'preset-aerthys',
  name: 'Crónicas de Aerthys (Padrão Mural)',
  description: 'Calendário padrão da campanha de investigação e conspiração em Aerthys.',
  weekdays: ['Solstício', 'Lunare', 'Terçum', 'Chama', 'Ventura', 'Sabático', 'Repouso'],
  months: [
    { id: 'm1', name: 'Bruma', days: 30, season: 'Inverno' },
    { id: 'm2', name: 'Gélido', days: 30, season: 'Inverno' },
    { id: 'm3', name: 'Germinar', days: 31, season: 'Primavera' },
    { id: 'm4', name: 'Chuva Doce', days: 30, season: 'Primavera' },
    { id: 'm5', name: 'Verdecer', days: 31, season: 'Primavera' },
    { id: 'm6', name: 'Solaris', days: 30, season: 'Verão' },
    { id: 'm7', name: 'Ápice', days: 31, season: 'Verão' },
    { id: 'm8', name: 'Seca', days: 31, season: 'Verão' },
    { id: 'm9', name: 'Colheita', days: 30, season: 'Outono' },
    { id: 'm10', name: 'Crepúsculo', days: 31, season: 'Outono' },
    { id: 'm11', name: 'Ocaso', days: 30, season: 'Outono' },
    { id: 'm12', name: 'Eterno', days: 31, season: 'Inverno' },
  ],
  yearPrefix: 'Ano',
  yearSuffix: 'da 3ª Era',
  currentYear: 998,
  currentMonthIndex: 0, // Bruma
  currentDay: 14,
  leapYearRule: {
    enabled: true,
    intervalYears: 4,
    monthIndex: 6, // Ápice
    extraDays: 1,
  },
  moons: [
    {
      id: 'moon-aerthys-1',
      name: 'Lua Pálida',
      cycleDays: 28,
      startingPhaseDay: 0,
      color: '#cbd5e1',
    },
    {
      id: 'moon-aerthys-2',
      name: 'Lua Carmesim',
      cycleDays: 35,
      startingPhaseDay: 10,
      color: '#f43f5e',
    },
  ],
  holidays: [
    { id: 'h1', name: 'Noite dos Murais', monthIndex: 0, day: 1, description: 'Celebração da fundação de Vallenmoor.' },
    { id: 'h2', name: 'Solstício da Chama', monthIndex: 6, day: 15, description: 'Festival do Fogo Ancestral.' },
  ],
};

export const CALENDAR_PRESETS: CustomCalendarConfig[] = [
  AERTHYS_PRESET,
  HARPTOS_PRESET,
  GREGORIAN_PRESET,
  ARTON_PRESET,
  LUNAR_13_PRESET,
];
