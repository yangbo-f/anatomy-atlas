const exactNames = {
  'external abdominal oblique muscle': '腹外斜肌',
  'internal abdominal oblique muscle': '腹内斜肌',
  'transversus abdominis muscle': '腹横肌',
  'rectus abdominis muscle': '腹直肌',
  'pyramidalis muscle': '锥状肌',
  'quadratus lumborum muscle': '腰方肌',
  'semispinalis thoracis muscle': '胸半棘肌',
  'vastus lateralis muscle': '股外侧肌',
  'extensor digitorum longus': '趾长伸肌',
  'tensor fasciae latae': '阔筋膜张肌',
  'sternocleidomastoid muscle': '胸锁乳突肌',
  'pectoralis major muscle': '胸大肌',
  'pectoralis minor muscle': '胸小肌',
  'latissimus dorsi muscle': '背阔肌',
  'trapezius muscle': '斜方肌',
  'deltoid muscle': '三角肌',
  'biceps brachii muscle': '肱二头肌',
  'triceps brachii muscle': '肱三头肌',
  'brachialis muscle': '肱肌',
  'gluteus maximus muscle': '臀大肌',
  'gluteus medius muscle': '臀中肌',
  'gluteus minimus muscle': '臀小肌',
  'biceps femoris muscle': '股二头肌',
  'rectus femoris muscle': '股直肌',
  'vastus medialis muscle': '股内侧肌',
  'vastus intermedius muscle': '股中间肌',
  'sartorius muscle': '缝匠肌',
  'gracilis muscle': '股薄肌',
  'gastrocnemius muscle': '腓肠肌',
  'soleus muscle': '比目鱼肌',
  'tibialis anterior muscle': '胫骨前肌',
  'tibialis posterior muscle': '胫骨后肌',
  'fibularis longus muscle': '腓骨长肌',
  'fibularis brevis muscle': '腓骨短肌',
  'linea alba': '腹白线',
  'inguinal ligament': '腹股沟韧带',
  incus: '砧骨',
  malleus: '锤骨',
  stapes: '镫骨',
  'hip bone': '髋骨',
  scapula: '肩胛骨',
  clavicle: '锁骨',
  sternum: '胸骨',
  mandible: '下颌骨',
  maxilla: '上颌骨',
  sacrum: '骶骨',
  coccyx: '尾骨',
  patella: '髌骨',
  femur: '股骨',
  tibia: '胫骨',
  fibula: '腓骨',
  humerus: '肱骨',
  radius: '桡骨',
  ulna: '尺骨',
  'left atrium': '左心房',
  'right atrium': '右心房',
  'left ventricle': '左心室',
  'right ventricle': '右心室',
  aorta: '主动脉',
  'ascending colon': '升结肠',
  'descending colon': '降结肠',
  'transverse colon': '横结肠',
  'sigmoid colon': '乙状结肠',
  'vermiform appendix': '阑尾',
  'greater omentum': '大网膜',
  'lesser omentum': '小网膜',
  'fourth ventricle': '第四脑室',
  'medulla oblongata': '延髓',
};

const phraseNames = [
  ['muscle', '肌'],
  ['artery', '动脉'],
  ['vein', '静脉'],
  ['nerve', '神经'],
  ['ligament', '韧带'],
  ['tendon', '肌腱'],
  ['fascia', '筋膜'],
  ['bursa', '滑囊'],
  ['bone', '骨'],
  ['joint', '关节'],
  ['cartilage', '软骨'],
  ['membrane', '膜'],
  ['ventricle', '室'],
  ['atrium', '房'],
  ['nucleus', '核'],
  ['ganglion', '神经节'],
  ['plexus', '丛'],
  ['node', '结'],
  ['nodes', '结'],
  ['lobe', '叶'],
  ['head', '头'],
  ['body', '体'],
  ['branch', '支'],
  ['branches', '支'],
  ['left', '左'],
  ['right', '右'],
  ['anterior', '前'],
  ['posterior', '后'],
  ['superior', '上'],
  ['inferior', '下'],
  ['medial', '内侧'],
  ['lateral', '外侧'],
  ['superficial', '浅'],
  ['deep', '深'],
  ['major', '大'],
  ['minor', '小'],
  ['long', '长'],
  ['short', '短'],
  ['thoracic', '胸'],
  ['abdominal', '腹'],
  ['cervical', '颈'],
  ['lumbar', '腰'],
  ['pelvic', '盆'],
  ['femoral', '股'],
  ['tibial', '胫'],
  ['fibular', '腓'],
  ['radial', '桡'],
  ['ulnar', '尺'],
  ['coronary', '冠状'],
  ['intercostal', '肋间'],
  ['spinal', '脊'],
  ['pulmonary', '肺'],
  ['renal', '肾'],
  ['hepatic', '肝'],
  ['gastric', '胃'],
];

function splitSideSuffix(name) {
  const trimmed = name.trim();
  const dottedSide = trimmed.match(/^(.*?)[._]([lr])$/i);
  if (dottedSide) return { base: dottedSide[1], side: dottedSide[2].toLowerCase() };

  const compactSide = trimmed.match(
    /^(.*(?:muscle|bone|artery|vein|nerve|ligament|fascia|bursa))([lr])$/i,
  );
  if (compactSide) return { base: compactSide[1], side: compactSide[2].toLowerCase() };
  return { base: trimmed, side: '' };
}

function translateByPhrases(name) {
  let translated = name.toLowerCase();
  let replacements = 0;
  phraseNames.forEach(([english, chinese]) => {
    const pattern = new RegExp(`\\b${english}\\b`, 'gi');
    translated = translated.replace(pattern, () => {
      replacements += 1;
      return chinese;
    });
  });
  if (!replacements || /[a-z]/i.test(translated)) return '';
  return translated
    .replace(/[()[\],]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '');
}

export function getBilingualStructureName(rawName) {
  const englishSource = (rawName || 'Unnamed anatomical structure').replaceAll('_', ' ').trim();
  const { base, side } = splitSideSuffix(englishSource);
  const translationBase = base.replace(/\s+\d+$/, '');
  const normalized = translationBase.toLowerCase().replace(/\s+/g, ' ').trim();
  const sideChinese = side === 'l' ? '左侧' : side === 'r' ? '右侧' : '';
  const sideEnglish = side === 'l' ? 'Left' : side === 'r' ? 'Right' : '';
  const translatedBase = exactNames[normalized] || translateByPhrases(translationBase);

  return {
    chinese: translatedBase
      ? `${sideChinese}${translatedBase}`
      : `中文名称待补充${sideChinese ? `（${sideChinese}）` : ''}`,
    english: sideEnglish ? `${base} (${sideEnglish})` : base,
  };
}
