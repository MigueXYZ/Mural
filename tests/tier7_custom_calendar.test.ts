// File: tests/tier7_custom_calendar.test.ts

import { describe, it, expect } from './harness';
import {
  isLeapYear,
  getDaysInMonth,
  getDaysInYear,
  calculateTotalDays,
  calculateDateFromTotalDays,
  getDayOfWeek,
  getMoonPhases,
  advanceDays,
  advanceMonths,
  advanceYears,
  formatDate,
  HARPTOS_PRESET,
  GREGORIAN_PRESET,
  ARTON_PRESET,
  LUNAR_13_PRESET,
  AERTHYS_PRESET,
} from '../src/lib/services/calendar/calendarEngine';
import type { CustomCalendarConfig } from '../src/lib/types';

describe('Taiga US 154: Custom Calendar System', () => {
  const customTestCalendar: CustomCalendarConfig = {
    id: 'test-cal',
    name: 'Calendário Arcano',
    weekdays: ['Sol', 'Lua', 'Fogo', 'Vento', 'Terra'], // 5 days week
    months: [
      { id: 'm1', name: 'Primeiro Mês', days: 20, season: 'Primavera' },
      { id: 'm2', name: 'Segundo Mês', days: 25, season: 'Verão' },
      { id: 'm3', name: 'Terceiro Mês', days: 30, season: 'Outono' },
      { id: 'm4', name: 'Quarto Mês', days: 15, season: 'Inverno' },
    ],
    yearPrefix: 'Ciclo',
    yearSuffix: 'de Eldoria',
    currentYear: 100,
    currentMonthIndex: 0,
    currentDay: 1,
    leapYearRule: {
      enabled: true,
      intervalYears: 5,
      monthIndex: 1, // Segundo Mês receives extra days
      extraDays: 2,
    },
    moons: [
      {
        id: 'moon-alpha',
        name: 'Lua Branca',
        cycleDays: 20,
        startingPhaseDay: 0,
      },
      {
        id: 'moon-beta',
        name: 'Lua Roxa',
        cycleDays: 10,
        startingPhaseDay: 5,
      },
    ],
    holidays: [
      {
        id: 'h-sol',
        name: 'Festival do Fogo',
        monthIndex: 1,
        day: 10,
        description: 'Dia sagrado.',
      },
    ],
  };

  it('calculates custom month days and leap year rules accurately', () => {
    // Year 100 is divisible by 5 -> Leap year!
    expect(isLeapYear(100, customTestCalendar)).toBe(true);
    expect(isLeapYear(101, customTestCalendar)).toBe(false);

    // In normal year: m1 = 20, m2 = 25, m3 = 30, m4 = 15 -> total = 90
    expect(getDaysInMonth(101, 1, customTestCalendar)).toBe(25);
    expect(getDaysInYear(101, customTestCalendar)).toBe(90);

    // In leap year 100: m2 gets +2 extra days = 27 -> total = 92
    expect(getDaysInMonth(100, 1, customTestCalendar)).toBe(27);
    expect(getDaysInYear(100, customTestCalendar)).toBe(92);
  });

  it('calculates day of week for arbitrary custom weekday names and lengths', () => {
    // 5-day week: Sol, Lua, Fogo, Vento, Terra
    const day1 = getDayOfWeek(100, 0, 1, customTestCalendar);
    expect(day1.name).toBeDefined();

    // Day 2 should be the next weekday in the cycle
    const day2 = getDayOfWeek(100, 0, 2, customTestCalendar);
    const day1Index = customTestCalendar.weekdays.indexOf(day1.name);
    const expectedDay2Index = (day1Index + 1) % customTestCalendar.weekdays.length;
    expect(day2.name).toBe(customTestCalendar.weekdays[expectedDay2Index]);
  });

  it('calculates accurate multi-moon phases and illuminations', () => {
    const moons = getMoonPhases(100, 0, 1, customTestCalendar);
    expect(moons.length).toBe(2);
    expect(moons[0].moon.name).toBe('Lua Branca');
    expect(moons[0].phaseIcon).toBeDefined();
    expect(moons[0].illuminationPercent).toBeGreaterThanOrEqual(0);
    expect(moons[0].illuminationPercent).toBeLessThanOrEqual(100);

    expect(moons[1].moon.name).toBe('Lua Roxa');
    expect(moons[1].phaseName).toBeDefined();
  });

  it('advances calendar days, months, and years with proper overflow wrapping', () => {
    let cal = { ...customTestCalendar, currentYear: 101, currentMonthIndex: 0, currentDay: 19 }; // Normal year
    
    // Day 19 + 2 days = Day 21 (Month 0 has 20 days -> transitions to Month 1, Day 1)
    cal = advanceDays(cal, 2);
    expect(cal.currentMonthIndex).toBe(1);
    expect(cal.currentDay).toBe(1);

    // Advance 3 months -> Month 1 + 3 = Month 4 -> wraps to Year 102, Month 0
    cal = advanceMonths(cal, 3);
    expect(cal.currentYear).toBe(102);
    expect(cal.currentMonthIndex).toBe(0);

    // Advance 5 years
    cal = advanceYears(cal, 5);
    expect(cal.currentYear).toBe(107);
  });

  it('converts total days to dates and back losslessly', () => {
    const cal = AERTHYS_PRESET;
    const total = calculateTotalDays(998, 5, 15, cal);
    const roundtrip = calculateDateFromTotalDays(total, cal);

    expect(roundtrip.year).toBe(998);
    expect(roundtrip.monthIndex).toBe(5);
    expect(roundtrip.day).toBe(15);
  });

  it('formats custom dates with prefixes and suffixes properly', () => {
    const formatted = formatDate(customTestCalendar, { year: 100, monthIndex: 1, day: 10 });
    expect(formatted).toBe('10 de Segundo Mês, Ciclo 100 de Eldoria');

    const formattedHarptos = formatDate(HARPTOS_PRESET, { year: 1492, monthIndex: 6, day: 1 });
    expect(formattedHarptos).toContain('1 de Flamerule (A Cimeira do Sol)');
    expect(formattedHarptos).toContain('1492 DR (Cômputo dos Vales)');
  });

  it('verifies all preconfigured presets have valid definitions', () => {
    const presets = [HARPTOS_PRESET, GREGORIAN_PRESET, ARTON_PRESET, LUNAR_13_PRESET, AERTHYS_PRESET];
    
    for (const p of presets) {
      expect(p.months.length).toBeGreaterThan(0);
      expect(p.weekdays.length).toBeGreaterThan(0);
      expect(p.currentYear).toBeGreaterThan(0);
      expect(getDaysInYear(p.currentYear, p)).toBeGreaterThan(0);
      expect(formatDate(p)).toBeDefined();
    }
  });

  it('synchronizes custom calendar updates with campaign data and timeline', () => {
    let campaign: any = {
      name: 'Tormenta Campaign',
      inGamePeriod: '1 de Valkaria, Ano 1410',
      customCalendar: JSON.parse(JSON.stringify(ARTON_PRESET)),
      timeline: [{ id: 't1', sessionNumber: 1, inGameDate: '1 de Valkaria, Ano 1410' }],
    };

    function updateCalendar(config: CustomCalendarConfig) {
      campaign.customCalendar = JSON.parse(JSON.stringify(config));
      const formatted = formatDate(config);
      campaign.inGamePeriod = formatted;
      campaign.timeline[0].inGameDate = formatted;
    }

    updateCalendar(HARPTOS_PRESET);
    expect(campaign.customCalendar.name).toBe(HARPTOS_PRESET.name);
    expect(campaign.inGamePeriod).toBe(formatDate(HARPTOS_PRESET));
    expect(campaign.timeline[0].inGameDate).toBe(formatDate(HARPTOS_PRESET));

    // Advance 1 day
    const updated = advanceDays(campaign.customCalendar, 1);
    updateCalendar(updated);
    expect(campaign.customCalendar.currentDay).toBe(HARPTOS_PRESET.currentDay + 1);
    expect(campaign.inGamePeriod).toContain(`${HARPTOS_PRESET.currentDay + 1} de`);

    // Ensure moon phases are calculated
    const moons = getMoonPhases(campaign.customCalendar.currentYear, campaign.customCalendar.currentMonthIndex, campaign.customCalendar.currentDay, campaign.customCalendar);
    expect(moons.length).toBeGreaterThan(0);
    expect(moons[0].moon.name).toBe('Selûne');
  });
});
