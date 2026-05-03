import type { Need } from './types';
import { EMPTY_SOURCES } from './types';

function n(id: string, name: string, domain: Need['domain']): Need {
  return {
    id,
    name,
    domain,
    priority: 0,
    currentlyMet: 0,
    sources: structuredClone(EMPTY_SOURCES),
  };
}

// 25 needs across 8 domains. Trimmed from an earlier 35 to remove
// near-synonyms (e.g. "feeling understood" / "being known"; "freedom to
// choose" / "self-determination"; "awe" / "connection to something bigger")
// and to split the emotional cluster into steady-state ("loved & accepted")
// vs acute ("emotionally held in distress"). Adds two gap-fillers
// (belonging/community, shared play) the original list missed.
export const SEED_NEEDS: Need[] = [
  // Purpose / Contribution
  n('building-meaningful',      'Building something meaningful',         'Purpose / Contribution'),
  n('contributing-to-others',   'Contributing to others',                'Purpose / Contribution'),

  // Relational / Social
  n('deep-conversations',       'Deep conversations',                    'Relational / Social'),
  n('being-known',              'Being known',                           'Relational / Social'),
  n('mutual-care',              'Mutual care',                           'Relational / Social'),
  n('shared-laughter-play',     'Shared laughter & play',                'Relational / Social'),
  n('belonging-community',      'Belonging / community',                 'Relational / Social'),

  // Cognitive / Intellectual
  n('intellectual-stimulation', 'Intellectual stimulation',              'Cognitive / Intellectual'),
  n('learning-exploring',       'Learning / exploring',                  'Cognitive / Intellectual'),
  n('riffing-on-ideas',         'Riffing on ideas',                      'Cognitive / Intellectual'),

  // Emotional
  n('loved-accepted',           'Feeling loved & accepted',              'Emotional'),
  n('emotionally-held',         'Feeling emotionally held in distress',  'Emotional'),
  n('feeling-safe',             'Feeling safe',                          'Emotional'),

  // Creative
  n('bringing-new-things',      'Bringing new things into the world',    'Creative'),
  n('co-creating',              'Co-creating with others',               'Creative'),
  n('encountering-beauty',      'Encountering beauty',                   'Creative'),

  // Physical
  n('movement-exercise',        'Movement / exercise',                   'Physical'),
  n('physical-touch',           'Physical touch',                        'Physical'),
  n('rest-sleep',               'Rest & sleep',                          'Physical'),
  n('nutrition',                'Nutrition',                             'Physical'),

  // Spiritual / Existential
  n('connection-bigger',        'Connection to something bigger',        'Spiritual / Existential'),
  n('wrestling-big-questions',  'Wrestling with big questions',          'Spiritual / Existential'),
  n('integrity-with-values',    'Integrity with values',                 'Spiritual / Existential'),

  // Autonomy / Agency
  n('self-determination',       'Self-determination',                    'Autonomy / Agency'),
  n('time-alone-reflect',       'Time alone to reflect',                 'Autonomy / Agency'),
];
