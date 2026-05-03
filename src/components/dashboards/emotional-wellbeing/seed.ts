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

export const SEED_NEEDS: Need[] = [
  n('building-meaningful',     'Building something meaningful',       'Purpose / Contribution'),
  n('mentoring-guiding',       'Mentoring / guiding others',          'Purpose / Contribution'),
  n('feeling-useful',          'Feeling useful',                      'Purpose / Contribution'),

  n('deep-conversations',      'Deep conversations',                  'Relational / Social'),
  n('being-known',             'Being known',                         'Relational / Social'),
  n('emotional-reciprocity',   'Emotional reciprocity',               'Relational / Social'),
  n('shared-laughter',         'Shared laughter',                     'Relational / Social'),
  n('mutual-care',             'Mutual care',                         'Relational / Social'),

  n('intellectual-stimulation','Intellectual stimulation',            'Cognitive / Intellectual'),
  n('learning-exploring',      'Learning / reading / exploring',      'Cognitive / Intellectual'),
  n('being-challenged',        'Being challenged and surprised',      'Cognitive / Intellectual'),
  n('riffing-on-ideas',        'Riffing on ideas',                    'Cognitive / Intellectual'),

  n('feeling-understood',      'Feeling understood',                  'Emotional'),
  n('emotionally-held',        'Feeling emotionally held / nurtured', 'Emotional'),
  n('feeling-loved',           'Feeling loved',                       'Emotional'),
  n('feeling-soothed',         'Feeling soothed when distressed',     'Emotional'),
  n('feeling-accepted',        'Feeling accepted',                    'Emotional'),
  n('feeling-safe',            'Feeling safe',                        'Emotional'),

  n('bringing-new-things',     'Bringing new things into the world',  'Creative'),
  n('co-creating',             'Co-creating with others',             'Creative'),
  n('symbols-metaphors',       'Working with symbols / metaphors',    'Creative'),
  n('seeing-beauty',           'Seeing beauty',                       'Creative'),

  n('movement-exercise',       'Movement / exercise',                 'Physical'),
  n('physical-touch',          'Physical touch',                      'Physical'),
  n('rest-relaxation',         'Rest / relaxation',                   'Physical'),
  n('sleep-quality',           'Sleep quality',                       'Physical'),
  n('nutrition',               'Nutrition',                           'Physical'),

  n('connection-bigger',       'Connection to something bigger',      'Spiritual / Existential'),
  n('awe-reverence',           'Awe and reverence',                   'Spiritual / Existential'),
  n('wrestling-big-questions', 'Wrestling with big questions',        'Spiritual / Existential'),
  n('life-coherence',          'Life coherence',                      'Spiritual / Existential'),
  n('integrity-with-values',   'Integrity with values',               'Spiritual / Existential'),

  n('freedom-to-choose',       'Freedom to choose',                   'Autonomy / Agency'),
  n('self-determination',      'Self-determination',                  'Autonomy / Agency'),
  n('time-alone-reflect',      'Time alone to reflect',               'Autonomy / Agency'),
];
