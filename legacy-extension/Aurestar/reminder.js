const params = new URLSearchParams(location.search);
const type = params.get('type') || 'study';
const quotes = {
  wake: [
    'Every morning is a new beginning.',
    'The secret of getting ahead is getting started.'
  ],
  study: [
    'Start now. Not later.',
    'Well begun is half done.',
    'It always seems impossible until it is done.',
    'Great things are done by a series of small things brought together.',
    'The secret of getting ahead is getting started.',
    'You do not have to see the whole staircase; just take the first step.'
  ],
  'wind-down': [
    'Rest is not idleness; it is part of the work.',
    'Almost everything will work again if you unplug it for a few minutes, including you.'
  ],
  sleep: [
    'A good day to rest is a chance to begin again tomorrow.',
    'A well-spent day brings happy sleep.'
  ],
  water: [
    'Take a breath. Drink some water. Begin again.',
    'Almost everything will work again after a little rest.'
  ]
};
const list = quotes[type] || quotes.study;
const line = list[Math.floor(Math.random() * list.length)];
const quote = document.getElementById('quote');
quote.textContent = '\u201c' + line + '\u201d';
quote.setAttribute('aria-label', line);
document.title = 'Aurestar';
