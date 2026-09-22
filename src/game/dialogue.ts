export type Line = { speaker: string; text: string }

export type TalkContext = {
  mission: boolean
  integrity: number
  maraUsed: boolean
  beaconsLeft: number
  datacenterDone: boolean
  starlinkDone: boolean
  chargersLeft: number
}

const CITIZENS: Line[][] = [
  [
    { speaker: '', text: 'You drop out of the dark like a bad idea that learned manners.' },
    { speaker: '', text: 'The relays are out again. If that is your problem, the street is grateful and also in the way.' },
  ],
  [
    { speaker: '', text: 'I keep my eyes down. The drones do not like being watched, and I like my shift to end.' },
    { speaker: '', text: 'The face on your glass is the only new thing on this block all week.' },
  ],
  [
    { speaker: '', text: 'Glass Mile looks expensive until the lights die. Then it is just tall.' },
    { speaker: '', text: 'Swing high if you go north. The gaps got proud of themselves.' },
  ],
  [
    { speaker: '', text: 'Foundry smells like warm metal even when the shops are shut.' },
    { speaker: '', text: 'If a drone hums, do not debate it. Be somewhere else.' },
  ],
  [
    { speaker: '', text: 'Lantern Row used to earn the name. Tonight the lamps are doing charity work.' },
    { speaker: '', text: 'People call you Bot-Man. It stuck faster than the official word, whatever that was.' },
  ],
  [
    { speaker: '', text: 'Antenna Ward clicks all night. I sleep with the window shut and still hear it.' },
    { speaker: '', text: 'There is a pad on a north roof that stays cold until the relays agree. I have never been invited.' },
  ],
  [
    { speaker: '', text: 'You can land on the roofs. The landlords pretend not to know.' },
    { speaker: '', text: 'Let go of the cable when you are lowest. An old courier told me that, then moved away.' },
  ],
  [
    { speaker: '', text: 'I sell tea to the night shift. Tonight they want rumors instead.' },
    { speaker: '', text: 'Tell Nia the plaza kettle is on, if you are the sort of machine that passes messages.' },
  ],
]

const BARKS = [
  'Up there.',
  'That is the bot.',
  'Whoa.',
  'Look at the face.',
  'Mind the lamp.',
  'Night circuit again.',
  'He is not slowing down.',
  'There he goes.',
]

const PAIR_BARKS = [
  'I am telling you, the bulbs are fine.',
  'Then why is the ward dark?',
  'Ask the roof, not me.',
  'Dumplings first. Apocalypse second.',
]

export function citizenLines(index: number): Line[] {
  return CITIZENS[index % CITIZENS.length]
}

export function barkLine(index: number): string {
  return BARKS[index % BARKS.length]
}

export function pairBark(index: number): string {
  return PAIR_BARKS[index % PAIR_BARKS.length]
}

function sideJobs(ctx: TalkContext): string {
  const left: string[] = []
  if (!ctx.datacenterDone) left.push('the datacenter reset')
  if (!ctx.starlinkDone) left.push('the Starlink dish')
  if (ctx.chargersLeft > 0) left.push(`${ctx.chargersLeft} Tesla posts`)
  if (left.length === 0) return 'The side jobs are done. I will be here. The plaza does not get a night off.'
  return `Still open: ${left.join(', ')}.`
}

export function conversation(
  id: string,
  name: string,
  index: number,
  ctx: TalkContext,
): { role: string; lines: Line[] } {
  if (id === 'nia') {
    return {
      role: 'Dispatcher',
      lines: ctx.mission
        ? [
            { speaker: 'Nia Voss', text: ctx.beaconsLeft === 0
              ? 'All four are singing. The extract pad on the high north roof is awake. Go home the long way.'
              : `${ctx.beaconsLeft} still dark. Nearest beam is marked. Swing through it, do not pose for it.` },
            { speaker: 'Nia Voss', text: sideJobs(ctx) },
          ]
        : [
            { speaker: 'Nia Voss', text: 'You came down the long way. Good. The stairs take all night.' },
            { speaker: 'Nia Voss', text: 'Four relays are dark. Glass Mile, Lantern Row, the Foundry, Antenna Ward. Any order. Swing through the beam and it wakes.' },
            { speaker: 'Nia Voss', text: 'The Foundry datacenter has a crowd that will not move until someone stands on the roof and presses reset. The Starlink dish in Antenna Ward is blind until you realign it. Three Tesla posts on Lantern Row are dark. Swing through them.' },
            { speaker: 'Nia Voss', text: 'When the fourth relay agrees, a pad opens on the tall roof north of here. That is the way out of the job, not out of the city.' },
          ],
    }
  }
  if (id === 'jun') {
    return {
      role: 'Roof tech',
      lines: [
        { speaker: 'Jun Park', text: 'You land heavier than you look. The wind up here is the honest one.' },
        { speaker: 'Jun Park', text: 'Wait until the fall turns into a rise. That is the bottom of the arc. Let go there and the city gives the speed back. That is a sling.' },
        { speaker: 'Jun Park', text: 'If a corner catches you, do not wrestle it. The kick throws you up. Fire again before you get polite.' },
      ],
    }
  }
  if (id === 'ivo') {
    return {
      role: 'Lantern Row',
      lines: [
        { speaker: 'Ivo Pell', text: 'They keep asking who you are. I tell them the face is enough, and then they have to sit with that.' },
        { speaker: 'Ivo Pell', text: 'A machine body, a courier’s hours, that mark on the glass. The plaza named you Bot-Man and went back to dinner.' },
        { speaker: 'Ivo Pell', text: 'The drones are not angry. They are just bad at missing. Be faster than their mood.' },
      ],
    }
  }
  if (id === 'mara') {
    if (ctx.maraUsed) {
      return {
        role: 'Street medic',
        lines: [
          { speaker: 'Mara Ell', text: 'I already spent the good patch on you. Try not to collect the rest of the ward with your shoulder.' },
        ],
      }
    }
    if (ctx.integrity >= 3) {
      return {
        role: 'Street medic',
        lines: [
          { speaker: 'Mara Ell', text: 'Sensors are whole. I am not in the business of decorating healthy machines.' },
          { speaker: 'Mara Ell', text: 'Come back if a drone writes its name on you. Once. I am not a rooftop.' },
        ],
      }
    }
    return {
      role: 'Street medic',
      lines: [
        { speaker: 'Mara Ell', text: 'Sensor’s chipped. Hold still. I am not climbing a roof for you.' },
        { speaker: 'Mara Ell', text: 'There. One light back. Do not spend it introducing yourself to a wall.' },
      ],
    }
  }
  if (id === 'lale') {
    return {
      role: 'Night vendor',
      lines: [
        { speaker: 'Lale', text: 'They dimmed the Glass Mile again. Rafi thinks it is the bulbs.' },
        { speaker: 'Rafi', text: 'It is the relays, not the bulbs. You can see the dead ones from any roof with a spine.' },
        { speaker: 'Lale', text: 'Then we wait for the courier and we do not stand in the road while we wait.' },
      ],
    }
  }
  if (id === 'nori') {
    return {
      role: 'Foundry stoop',
      lines: [
        { speaker: 'Nori', text: 'The night shift wants the lights more than the day shift does. Day shift has the sun doing unpaid work.' },
        { speaker: 'Pavel', text: 'Tell the courier, not me. I have dumplings and a limited sense of civic duty.' },
        { speaker: 'Nori', text: 'You are the courier. He will pretend this was his idea.' },
      ],
    }
  }
  const lines = citizenLines(index).map((line) => ({ speaker: name, text: line.text }))
  return { role: 'On the walk', lines }
}
