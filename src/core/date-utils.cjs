'use strict';

function parseCalendarDate(value) {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Invalid calendar date.');
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Invalid calendar date.');
  }
  return date;
}

function formatLocalDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date value.');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addCalendarDays(value, amount) {
  const date = parseCalendarDate(value);
  const days = Number(amount);
  if (!Number.isInteger(days)) throw new Error('Calendar day offset must be an integer.');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(value, weekStartsOn = 1) {
  const date = parseCalendarDate(value);
  const firstDay = Number(weekStartsOn);
  if (!Number.isInteger(firstDay) || firstDay < 0 || firstDay > 6) throw new Error('Week start must be between 0 and 6.');
  const offset = (date.getUTCDay() - firstDay + 7) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function endOfWeek(value, weekStartsOn = 1) {
  return addCalendarDays(startOfWeek(value, weekStartsOn), 6);
}

module.exports = { parseCalendarDate, formatLocalDate, addCalendarDays, startOfWeek, endOfWeek };
