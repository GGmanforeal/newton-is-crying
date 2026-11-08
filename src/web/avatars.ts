import type { Mood, ScientistId } from '../core/roasts';

/**
 * Tiny parametric cartoon portraits (pure SVG, no image files).
 * Each scientist gets a recognisable silhouette: Newton's wig, Einstein's hair,
 * Curie's bun, the turbans of the Central Asian scholars…
 */
interface Look {
  skin: string;
  hair: string;
  hairStyle: 'wig' | 'wild' | 'bun' | 'short' | 'turban';
  turban?: string;
  beard?: string;
  mustache?: string;
}

const LOOKS: Record<ScientistId, Look> = {
  newton: { skin: '#f3d2b3', hair: '#e8e4dc', hairStyle: 'wig' },
  einstein: { skin: '#f1cfae', hair: '#f4f4f4', hairStyle: 'wild', mustache: '#dcdcdc' },
  curie: { skin: '#f5d9c0', hair: '#6b4a32', hairStyle: 'bun' },
  feynman: { skin: '#efc8a4', hair: '#5a3c26', hairStyle: 'short' },
  khwarizmi: { skin: '#d9a77e', hair: '#333', hairStyle: 'turban', turban: '#f2efe6', beard: '#9a9a9a' },
  ulughbeg: { skin: '#d6a27a', hair: '#222', hairStyle: 'turban', turban: '#2f8f6b', beard: '#2b2118' },
  biruni: { skin: '#d8a780', hair: '#333', hairStyle: 'turban', turban: '#e9d9a6', beard: '#efefef' },
};

function hair(l: Look): string {
  switch (l.hairStyle) {
    case 'wig':
      return [
        [30, 52, 16], [28, 70, 15], [32, 86, 13], [90, 52, 16], [92, 70, 15], [88, 86, 13],
        [42, 30, 16], [60, 24, 17], [78, 30, 16],
      ].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${l.hair}" stroke="#cfc8bb" stroke-width="1.5"/>`).join('');
    case 'wild':
      return `<path d="M24 62 L14 48 L28 46 L18 30 L36 34 L34 16 L50 28 L58 10 L66 27 L80 14 L82 32 L100 26 L92 44 L108 46 L96 60 Z" fill="${l.hair}" stroke="#d6d6d6" stroke-width="1.5"/>`;
    case 'bun':
      return `<circle cx="60" cy="20" r="13" fill="${l.hair}"/><path d="M30 60 Q30 26 60 26 Q90 26 90 60 Q84 38 60 38 Q36 38 30 60Z" fill="${l.hair}"/>`;
    case 'short':
      return `<path d="M32 54 Q30 24 60 24 Q90 24 88 54 Q82 36 70 38 Q60 32 48 38 Q38 38 32 54Z" fill="${l.hair}"/>`;
    case 'turban':
      return `<path d="M28 52 Q26 18 60 16 Q94 18 92 52 Q86 44 60 44 Q34 44 28 52Z" fill="${l.turban}" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>
        <path d="M34 34 Q60 22 88 40 M30 44 Q60 30 90 48" stroke="rgba(0,0,0,.15)" stroke-width="2" fill="none"/>`;
  }
}

function eyes(mood: Mood): string {
  const brow = {
    crying: 'M40 50 L52 54 M68 54 L80 50',
    furious: 'M40 48 L53 55 M67 55 L80 48',
    disappointed: 'M40 53 L52 53 M68 53 L80 53',
    confused: 'M40 50 L52 54 M68 48 Q74 44 80 49',
    proud: 'M40 50 Q46 46 52 50 M68 50 Q74 46 80 50',
  }[mood];
  const eye =
    mood === 'proud'
      ? '<path d="M41 61 Q46 56 51 61 M69 61 Q74 56 79 61" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/>'
      : mood === 'disappointed'
        ? '<path d="M41 61 L51 61 M69 61 L79 61" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>'
        : '<circle cx="46" cy="61" r="4" fill="#2b2b2b"/><circle cx="74" cy="61" r="4" fill="#2b2b2b"/>';
  const tears =
    mood === 'crying'
      ? `<path class="tear" d="M44 66 Q41 76 44 82 Q47 76 44 66Z" fill="#5ab4ff"/>
         <path class="tear t2" d="M76 66 Q73 76 76 82 Q79 76 76 66Z" fill="#5ab4ff"/>`
      : '';
  return `<path d="${brow}" stroke="#3a2a20" stroke-width="3" stroke-linecap="round" fill="none"/>${eye}${tears}`;
}

function mouth(mood: Mood): string {
  const d = {
    crying: 'M48 90 Q60 80 72 90',
    furious: 'M48 90 L72 90',
    disappointed: 'M50 89 Q60 85 70 89',
    confused: 'M48 89 Q54 85 60 89 Q66 93 72 88',
    proud: 'M46 84 Q60 96 74 84',
  }[mood];
  return `<path d="${d}" stroke="#7a3328" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

export function avatarSvg(id: ScientistId, mood: Mood): string {
  const l = LOOKS[id];
  const flush = mood === 'furious' ? '<ellipse cx="60" cy="68" rx="26" ry="22" fill="#ff4d4d" opacity=".22"/>' : '';
  const beard = l.beard
    ? `<path d="M36 80 Q38 112 60 116 Q82 112 84 80 Q74 98 60 98 Q46 98 36 80Z" fill="${l.beard}"/>`
    : '';
  const mustache = l.mustache ? `<path d="M46 82 Q60 74 74 82 Q60 80 46 82Z" fill="${l.mustache}" stroke="#ccc"/>` : '';
  const behind = l.hairStyle === 'wig' || l.hairStyle === 'wild' || l.hairStyle === 'bun' ? hair(l) : '';
  const front = behind ? '' : hair(l);
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${id} looking ${mood}">
    ${behind}
    <ellipse cx="60" cy="68" rx="30" ry="34" fill="${l.skin}"/>
    <ellipse cx="30" cy="68" rx="5" ry="8" fill="${l.skin}"/><ellipse cx="90" cy="68" rx="5" ry="8" fill="${l.skin}"/>
    ${flush}${eyes(mood)}
    <path d="M60 64 Q56 74 60 76" stroke="rgba(0,0,0,.25)" stroke-width="2" fill="none"/>
    ${beard}${mouth(mood)}${mustache}${front}
  </svg>`;
}
