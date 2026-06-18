const COPY_POOLS = require('../public/data/copy-pools.json');

const FORTUNE_TOPICS = {
  love: '這關係還有戲嗎',
  career: '工作是不是有病',
  money: '該不該衝',
  study: '這題選什麼',
  food: '要吃什麼',
  travel: '去不去',
  decision: '幫我決定',
  roast: '隨便吐槽'
};

const FORTUNE_TOPIC_FALLBACKS = {
  love: 'love',
  career: 'career',
  money: 'money',
  study: 'study',
  food: 'food',
  travel: 'travel',
  decision: 'decision',
  roast: 'roast'
};

const FORTUNE_METHODS = {
  bagua: '八卦占卜',
  tarot: '塔羅牌'
};

const EXTERNAL_COPY_TOPICS = ['love', 'career', 'money', 'decision', 'roast'];

for (const topic of EXTERNAL_COPY_TOPICS) {
  if (!Array.isArray(COPY_POOLS[topic]) || COPY_POOLS[topic].length === 0) {
    throw new Error(`copy-pools.json must provide a non-empty "${topic}" array`);
  }
}

const FOOD_CHOICES = [
  ['鹹酥雞', '今天別假裝養生，快樂先裹粉下鍋。'],
  ['牛肉麵', '湯要熱，心可以冷，至少胃先被照顧。'],
  ['滷肉飯', '別再挑了，人生需要一碗務實的油亮。'],
  ['鍋貼', '脆皮能救的局，比你想像多一點。'],
  ['珍珠奶茶', '理智先放旁邊，糖分會暫時接管政權。'],
  ['臭豆腐', '越怕越該吃，反正你的人生也不全是香的。'],
  ['蚵仔煎', '糊一點沒關係，好吃比體面重要。'],
  ['雞排', '今天適合大塊解決，不要小口假優雅。'],
  ['肉圓', '外表軟，內心有料，跟你剛好相反。'],
  ['關東煮', '選幾串就好，別把便利商店當人生岔路口。'],
  ['麻辣燙', '需要一點刺激，不然你又要把無聊說成穩定。'],
  ['炒米粉', '簡單但可靠，比你那些複雜計畫強。'],
  ['小籠包', '小心燙，今天別連吃飯都衝動犯案。'],
  ['飯糰', '先把肚子黏住，靈魂晚點再處理。'],
  ['蔥油餅', '酥一點，人生已經夠軟爛了。'],
  ['豆花', '今天適合溫柔收尾，別再跟晚餐吵架。']
];

function pickFood(seed) {
  let hash = 0;
  String(seed).split('').forEach((char) => {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  });
  const [name, line] = FOOD_CHOICES[hash % FOOD_CHOICES.length];
  return { name, line };
}

function stableIndex(seed, length) {
  let hash = 0;
  String(seed).split('').forEach((char) => {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  });
  return hash % length;
}

function fillCopy(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

const SUBJECT_PREFIXES = [
  '{subject}給的方向很直接：',
  '照 {subject} 來看，',
  '{subject}翻譯成人話：',
  '{subject}這次不拐彎：',
  '以 {subject} 的脾氣來說，'
];

function pickTopicCopy(pool, seed, values, subject) {
  const template = pool[stableIndex(seed, pool.length)];
  const text = fillCopy(template, values);
  if (!subject || template.includes('{title}') || template.includes('{card}')) {
    return text;
  }
  const prefix = fillCopy(SUBJECT_PREFIXES[stableIndex(`${seed}:prefix`, SUBJECT_PREFIXES.length)], { subject });
  return `${prefix}${text}`;
}

const BAGUA_TOPIC_COPY_POOLS = {
  love: [
    '看到 {title}，這段關係不像沒戲，比較像兩個人都在等對方先承認自己有在意。',
    '{title} 提醒你，對方不是神秘莫測，只是回訊息速度跟公家機關差不多。',
    '如果最近一直猜心，{title} 建議先停止腦補，劇情早就超出原作者設定。',
    '這段關係最大的問題不是沒感覺，而是誰都不想先把面子放下來。',
    '{title} 看起來像有機會，但前提是別把戀愛玩成心理戰模擬器。',
    '對方目前不像要跑，只是也沒有衝過來的意思，屬於慢到像在下載更新。',
    '你在等答案，對方在等氣氛，結果兩個人一起浪費青春。',
    '{title} 認為繼續觀察可以，但別把三天沒訊息解讀成世界末日。',
    '如果每次聊天都像面試，感情很難進展，履歷倒是快寫滿了。',
    '有些事直接問比占卜準，你來抽卦，他可能只是去洗澡。',
    '{title} 顯示有曖昧空間，但沒有到值得你一天刷新聊天室五十次。',
    '與其研究訊息標點符號，不如研究怎麼把話講清楚。'
  ],
  career: [
    '{title} 看起來不是工作有病，是病已經快被工作養出來了。',
    '最近職場像多人推責任大賽，獎品是更多工作和更少睡眠。',
    '主管不是看不到問題，他只是希望問題自己長腳離開。',
    '{title} 認為先保住薪水，再決定要不要保護公司未來。',
    '這份工作還能做，但熱情剩下的量大概只夠泡半杯咖啡。',
    '如果每天都想離職，問題可能不是今天，是已經累積半年了。',
    '{title} 提醒你別急著翻桌，先確認下一張桌子不是同一家店。',
    '職場目前像在修一艘漏水船，你修得越快，洞開得越快。',
    '有些同事不是能力差，只是把摸魚發展成專業技能。',
    '{title} 顯示近期適合低調保命，不適合熱血改革世界。',
    '別把公司的緊急事件當自己的人生使命，老闆都沒那麼投入。',
    '工作還沒到絕症，但已經值得安排一次健康檢查。'
  ],
  money: [
    '{title} 給的答案偏向小衝，不是全壓，別把勇敢和衝動搞混。',
    '想買可以買，但先問價，否則等等看到帳單先占卜的是你。',
    '這局先別衝，你喜歡的是幻想中的收益，不是現實中的風險。',
    '{title} 覺得可以進場，但請保留後悔藥基金。',
    '如果需要借錢才能衝，那答案其實已經很明顯了。',
    '先算，再衝；順序反了通常會變成繳學費。',
    '{title} 傾向觀望，你現在最強的技能是替自己找理由。',
    '能賺，但沒有你腦中試算表那麼誇張。',
    '這筆錢花下去會快樂一下，但不一定快樂很久。',
    '{title} 建議分批，不要一次把未來三個月的勇氣用完。',
    '想投資可以，小衝即可，別直接進入傳奇賭徒模式。',
    '價格不錯可以考慮，價格太高就讓別人先表演。',
    '{title} 看起來偏保守，今天忍住手比伸出手值錢。',
    '有機會，但先確認你是看懂標的，不是看懂留言區。',
    '先問自己如果跌二成還睡得著嗎，睡不著就別衝。',
    '{title} 認為目前適合存活，不適合豪賭。'
  ],
  study: [
    '{title} 建議先刪掉最蠢那個選項，剩下的再慢慢打。',
    '第一直覺有參考價值，但前提是你真的有讀過題目。',
    '回頭看題幹，你漏掉的資訊比你想像的多。',
    '{title} 提醒你不要一直改答案，考卷不是戀愛關係。',
    '如果兩個答案都很像，通常關鍵字藏在題目裡。',
    '先選最合理的，再懷疑人生，不要順序顛倒。',
    '{title} 認為這題考的是細節，不是想像力。',
    '你現在最大的敵人不是難題，是過度自信。',
    '看不懂時先跳過，未來的你可能比現在聰明三分鐘。',
    '{title} 顯示不要鑽牛角尖，先拿得到的分數。',
    '把最怪的答案刪掉，命中率會意外提升。',
    '這題別靠感覺，感覺上次也沒幫到你。',
    '{title} 建議先排除錯誤選項，再相信直覺。',
    '答案可能就在你剛剛匆忙略過的那一句。',
    '不要看到熟悉名詞就秒選，那是出題老師的陷阱。',
    '{title} 覺得穩穩作答比靈光一閃可靠。'
  ],
  travel: [
    '{title} 給的答案偏向去，但別排滿行程表。',
    '可以去，不過縮短一點，你需要放鬆不是挑戰體能。',
    '這趟最大的風險不是目的地，是同行的人。',
    '{title} 建議改天，現在去容易把旅遊變成修行。',
    '去吧，反正待在家也只是在另一個地方發呆。',
    '不要跟那個總是遲到的人一起去，真的。',
    '{title} 認為值得出門，但記得保留撤退路線。',
    '不去也沒損失，這次比較像衝動不是嚮往。',
    '如果只是想逃避工作，那景點換成公司樓下也差不多。',
    '{title} 傾向出發，但別把預算當都市傳說。',
    '去可以，別期待旅伴突然變成熟大人。',
    '這趟行程有趣，但別塞進二十個打卡點。',
    '{title} 建議先延期，現在運氣比較適合規劃。',
    '想去就去，很多後悔都比機票貴。',
    '去，但別跟會把旅遊變會議的人同行。',
    '{title} 看起來適合短程，不適合史詩遠征。'
  ],
  decision: [
    '{title} 建議選成本可逆的那個，錯了至少能回頭。',
    '先等一下，現在做決定像在肚子餓時逛超市。',
    '選 A，不是因為完美，而是 B 更麻煩。',
    '{title} 認為不要猜，直接去問當事人。',
    '如果兩個都不喜歡，那答案可能是第三個。',
    '先刪掉最讓你焦慮的選項。',
    '{title} 顯示暫緩比硬選更合理。',
    '選那個未來不用一直解釋的決定。',
    '你其實知道答案，只是在找占卜幫你背鍋。',
    '{title} 偏向行動，不要再開第八次內心會議。',
    '選比較簡單的，不是所有事情都值得燃燒生命。',
    '目前資訊不足，先收集情報再表演果斷。',
    '{title} 建議別用面子決定，用成本決定。',
    '選讓明天的自己比較輕鬆的那個。',
    '如果一定要選，選風險最小的版本。',
    '{title} 看起來答案已經出現，只是你不喜歡。'
  ],
  roast: [
    '{title} 看著你最近的操作，開始懷疑因果律是不是壞掉了。',
    '你最大的天賦是把簡單事情發展成連續劇。',
    '{title} 顯示你不是缺運氣，是太相信自己的靈感。',
    '別再說順其自然了，你連導航都不相信。',
    '你的計畫很多，完成度則保持神秘。',
    '{title} 認為拖延不是興趣，但你快把它做成副業。',
    '有些坑是意外踩到的，你的是自己挖的。',
    '最近的判斷力像手機剩一趴電還開省電模式。',
    '{title} 看完你的近況，沉默了三秒鐘。',
    '你很努力避免犯同樣的錯，於是開始犯新的。',
    '{title} 建議休息一下，你的腦袋正在背景更新。',
    '人生不是選秀節目，不需要每件事都製造反轉。',
    '別把運氣當策略，宇宙也有業績壓力。',
    '{title} 懷疑你最近最大的敵人就是昨天的自己。',
    '你不是沒有方向，只是方向盤轉得太勤。',
    '{title} 顯示目前最該優化的系統是本人。'
  ]
};

const TAROT_TOPIC_COPY_POOLS = {
  love: [
    '{card}{state} 看起來還有機會，只是兩邊都在等對方先破冰。',
    '別再研究已讀時間了，感情不是刑事鑑識科。',
    '{card}{state} 認為對方有想法，但行動力跟冬眠生物差不多。',
    '你在猜心，他在忙別的事，進度自然很感人。',
    '{card}{state} 提醒你，坦白一次勝過腦補一百次。',
    '這段關係還沒死透，但也還沒活蹦亂跳。',
    '{card}{state} 顯示現在需要溝通，不需要更多占卜。',
    '曖昧可以浪漫，拖太久就變行政流程。',
    '{card}{state} 看起來不是沒戲，是劇情推進太慢。',
    '對方未必冷淡，只是沒你想像中那麼戲劇化。',
    '{card}{state} 建議少觀察細節，多觀察事實。',
    '有感情基礎，但別期待奇蹟自動送貨到府。'
  ],
  career: [
    '{card}{state} 覺得工作有點病，但還沒病到要叫救護車。',
    '你在補位，公司在習慣，這是職場老問題。',
    '{card}{state} 提醒你別把所有責任都撿回家。',
    '主管的沉默不一定高深，可能只是忙到靈魂離線。',
    '{card}{state} 顯示近期適合保守操作，先把薪水拿穩。',
    '這份工作最大的挑戰不是內容，是人類。',
    '{card}{state} 建議先顧薪水，再顧理想，順序很殘酷但實用。',
    '有些會議不是解決問題，是把問題延後到下次會議。',
    '{card}{state} 認為離職先別急，先看市場，不然只是換坑自拍。',
    '最近像在搬磚，但磚一直自己增殖，職場真會繁殖壓力。',
    '{card}{state} 提醒你別把公司當人生全部，公司也沒把你當全部。',
    '工作能做，只是快樂庫存有點不足，該補眠就補眠。'
  ],
  money: [
    '{card}{state} 偏向小衝，保留現金比保留幻想重要。',
    '先算成本，再談夢想，不然夢想會直接變帳單。',
    '{card}{state} 認為別衝，今天衝動比機會多。',
    '能買，但不要買到需要祈禱，神明也有客服上限。',
    '{card}{state} 建議分批，不要一次把膽量花完。',
    '先問價，你現在比較像被氣氛影響，不像被理性祝福。',
    '{card}{state} 顯示可以進場，但控制手速，別把滑鼠當油門。',
    '別把投資做成情感寄託，它不會回你晚安。',
    '{card}{state} 傾向觀望，市場不缺今天這一天，你也不缺這個坑。',
    '小衝可以，全衝像在拍紀錄片，片名叫錢包消失術。',
    '{card}{state} 提醒你，風險也會複利，而且長得比收益勤快。',
    '有機會賺，但沒有想像中輕鬆，別先替自己頒獎。',
    '{card}{state} 覺得先存活再暴富，順序錯了會只剩故事。',
    '如果看不懂，先別衝，看熱鬧不需要付入場費。',
    '{card}{state} 建議把預算砍半再決定，心痛會立刻變清醒。',
    '想買可以，別買到睡不著，失眠利息很貴。'
  ],
  study: [
    '{card}{state} 建議回頭看題幹，答案常躲在你嫌麻煩的那句。',
    '先刪最離譜的答案，至少讓錯誤名單瘦一點。',
    '{card}{state} 認為第一直覺值得參考，但別把亂猜包裝成直覺。',
    '這題考細節，不考自信，你的氣勢不能拿分。',
    '{card}{state} 提醒你別一直改答案，考卷不是戀愛關係。',
    '先拿穩定分，不要追夢幻分，分數不吃你的浪漫。',
    '{card}{state} 顯示關鍵藏在題目裡，別急著跟選項私奔。',
    '兩個都像時，找最符合條件的，不是找最順眼的。',
    '{card}{state} 建議先跳過再回來，未來的你可能多三分鐘智慧。',
    '不要把熟悉感誤認成正確，出題老師最愛這種路邊陷阱。',
    '{card}{state} 看起來答案其實不遠，只是你剛剛走太快。',
    '先排除錯的，再選對的，人生可以混亂，答題先不要。',
    '{card}{state} 提醒你慢一點讀，關鍵字不會自己跳出來求你看。',
    '這題需要觀察，不需要勇氣，別把考試玩成冒險遊戲。',
    '{card}{state} 認為你漏看了重要字眼，它正在角落冷笑。',
    '別跟題目鬥氣，題目不會認輸，分數會先離場。'
  ],
  travel: [
    '{card}{state} 偏向去，但別排太滿，旅行不是行軍拉練。',
    '可以出發，不過縮短行程比較舒服，別把自己當行動電池。',
    '{card}{state} 建議改天，現在硬去容易把放假變成加班外景。',
    '不去也沒損失，這次比較像一時手癢，不像命運召喚。',
    '{card}{state} 認為最大的問題是旅伴，景點很無辜。',
    '去吧，反正家裡的沙發不會跑，你倒是快長在上面了。',
    '{card}{state} 提醒你控制預算，別讓伴手禮替錢包辦告別式。',
    '別跟會遲到的人一起去，除非你喜歡在車站修行。',
    '{card}{state} 顯示適合短途，遠征級行程先留給體能更像人的日子。',
    '這趟值得，但別期待完美，旅遊不是濾鏡成精。',
    '{card}{state} 建議延期一下，現在規劃比硬衝更像聰明人。',
    '去可以，別把自己累壞，度假不是換個城市崩潰。',
    '{card}{state} 認為換時間比取消好，別把心願直接丟垃圾桶。',
    '旅行是放鬆，不是鐵人三項，行程少一點不會被判刑。',
    '{card}{state} 看起來有收穫，但不要期待一路無痛通關。',
    '出門比待在原地更有答案，至少外面的風會比較誠實。'
  ],
  decision: [
    '{card}{state} 建議選成本最低的那個，面子不會替你付帳。',
    '先等一下，不急著今天決定，焦慮按下去通常不會比較準。',
    '{card}{state} 偏向 A，不是 A 完美，是 B 的麻煩味比較濃。',
    '直接問當事人比猜有效，你不是偵探，別加班破案。',
    '{card}{state} 顯示資訊還不夠，先補資料再裝果斷。',
    '選能回頭修改的方案，給未來的自己留一扇逃生門。',
    '{card}{state} 認為不要被面子綁架，它只會收贖金。',
    '你其實知道答案，只是在找一張牌幫你背鍋。',
    '{card}{state} 建議先排除最糟的，人生不必主動選地獄模式。',
    '選讓未來比較輕鬆的，那個未來的人也是你，別害他。',
    '{card}{state} 提醒你不要情緒決策，情緒很會簽爛合約。',
    '先睡一覺再選，腦袋沒充電時判斷力像免費試用版。',
    '{card}{state} 偏向行動，別再開第八次內心會議。',
    '不要把選擇題做成申論題，世界沒要你交八百字。',
    '{card}{state} 認為暫停也是選項，不動有時比亂動成熟。',
    '答案沒有完美版，選一個比較不會害你半夜捶床的。'
  ],
  roast: [
    '{card}{state} 看完你的近況，牌面差點自己翻回去。',
    '你的問題不是沒努力，是努力方向像抽獎。',
    '{card}{state} 懷疑你最近把運氣當企劃書，格式還沒對齊。',
    '拖延能力穩定發揮中，穩到可以列入履歷但不建議。',
    '{card}{state} 認為你很會把小事升級，像情緒版雲端備份。',
    '人生不是 Bug，你卻一直重現問題，測試精神很充足。',
    '{card}{state} 建議停止亂按按鈕，這不是電梯也不是人生攻略。',
    '有些彎路是命運安排，你的是自己導航還堅持不改路線。',
    '{card}{state} 看起來很想幫你，但規則不允許作弊。',
    '你的計畫很完整，執行像試用版，三天後自動過期。',
    '{card}{state} 懷疑你最近在和自己鬥智，而且雙方都很累。',
    '別擔心，你的問題很有創意，解法目前還在逃避你。',
    '{card}{state} 顯示最大的變數是本人，這個變數還很愛加戲。',
    '有時候放過自己，也放過宇宙，它今天已經很忙。',
    '{card}{state} 認為今天適合降低操作頻率，別把生活玩成連點器。',
    '你的故事很精彩，只是不建議模仿，連本人都未必承受得住。'
  ]
};

const TRIGRAMS = {
  qian: { title: '天', lines: ['front', 'front', 'front'] },
  dui: { title: '澤', lines: ['front', 'front', 'back'] },
  li: { title: '火', lines: ['front', 'back', 'front'] },
  zhen: { title: '雷', lines: ['front', 'back', 'back'] },
  xun: { title: '風', lines: ['back', 'front', 'front'] },
  kan: { title: '水', lines: ['back', 'front', 'back'] },
  gen: { title: '山', lines: ['back', 'back', 'front'] },
  kun: { title: '地', lines: ['back', 'back', 'back'] }
};

const TRIGRAM_ORDER = ['qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun'];

const HEXAGRAM_MATRIX = {
  qian: [
    ['乾為天', '主動、開創、貴人'],
    ['天澤履', '謹慎、禮節、觀察'],
    ['天火同人', '合作、人脈、交流'],
    ['天雷無妄', '真誠、自然、意外'],
    ['天風姤', '相遇、變化、機緣'],
    ['天水訟', '爭論、溝通、判斷'],
    ['天山遯', '退守、觀察、沉澱'],
    ['天地否', '停滯、調整、等待']
  ],
  dui: [
    ['澤天夬', '決斷、突破、行動'],
    ['兌為澤', '喜悅、人際、交流'],
    ['澤火革', '改革、更新、轉變'],
    ['澤雷隨', '順勢、跟隨、合作'],
    ['澤風大過', '負擔、承擔、平衡'],
    ['澤水困', '受限、忍耐、轉機'],
    ['澤山咸', '感應、吸引、互動'],
    ['澤地萃', '聚集、資源、人群']
  ],
  li: [
    ['火天大有', '豐盛、收穫、自信'],
    ['火澤睽', '差異、理解、磨合'],
    ['離為火', '熱情、光明、表現'],
    ['火雷噬嗑', '解決、果斷、執行'],
    ['火風鼎', '成長、調整、提升'],
    ['火水未濟', '未成、耐心、收尾'],
    ['火山旅', '旅行、變動、探索'],
    ['火地晉', '前進、成長、提升']
  ],
  zhen: [
    ['雷天大壯', '力量、突破、勇氣'],
    ['雷澤歸妹', '選擇、關係、判斷'],
    ['雷火豐', '豐盛、高峰、表現'],
    ['震為雷', '驚動、啟發、行動'],
    ['雷風恆', '持續、穩定、耐力'],
    ['雷水解', '化解、釋放、改善'],
    ['雷山小過', '謹慎、細節、修正'],
    ['雷地豫', '喜悅、準備、期待']
  ],
  xun: [
    ['風天小畜', '累積、等待、準備'],
    ['風澤中孚', '誠信、信任、真心'],
    ['風火家人', '家庭、責任、互助'],
    ['風雷益', '增長、收穫、助力'],
    ['巽為風', '滲透、柔和、影響'],
    ['風水渙', '散開、調整、重整'],
    ['風山漸', '漸進、累積、穩健'],
    ['風地觀', '觀察、思考、理解']
  ],
  kan: [
    ['水天需', '等待、時機、耐心'],
    ['水澤節', '節制、平衡、規劃'],
    ['水火既濟', '完成、平衡、成果'],
    ['水雷屯', '起步、困難、成長'],
    ['水風井', '基礎、資源、補充'],
    ['坎為水', '挑戰、考驗、突破'],
    ['水山蹇', '阻礙、繞路、調整'],
    ['水地比', '支持、合作、連結']
  ],
  gen: [
    ['山天大畜', '儲備、累積、實力'],
    ['山澤損', '減法、取捨、精簡'],
    ['山火賁', '修飾、美感、包裝'],
    ['山雷頤', '養成、照顧、學習'],
    ['山風蠱', '整頓、修復、改善'],
    ['山水蒙', '學習、探索、啟蒙'],
    ['艮為山', '停止、沉澱、冷靜'],
    ['山地剝', '整理、淘汰、更新']
  ],
  kun: [
    ['地天泰', '順利、和諧、發展'],
    ['地澤臨', '接近、機會、成長'],
    ['地火明夷', '低調、保護、隱忍'],
    ['地雷復', '回歸、重來、修正'],
    ['地風升', '上升、成長、進步'],
    ['地水師', '紀律、團隊、執行'],
    ['地山謙', '謙虛、穩健、成長'],
    ['坤為地', '包容、承載、穩定']
  ]
};

function baguaText(title, keywords) {
  const food = pickFood(`${title}:${keywords}`);
  const values = { title };
  return {
    love: pickTopicCopy(COPY_POOLS.love, `${title}:love`, values, title),
    study: pickTopicCopy(BAGUA_TOPIC_COPY_POOLS.study, `${title}:study`, values, title),
    career: pickTopicCopy(COPY_POOLS.career, `${title}:career`, values, title),
    money: pickTopicCopy(COPY_POOLS.money, `${title}:money`, values, title),
    food: `${title}點名${food.name}。${food.line}`,
    travel: pickTopicCopy(BAGUA_TOPIC_COPY_POOLS.travel, `${title}:travel`, values, title),
    decision: pickTopicCopy(COPY_POOLS.decision, `${title}:decision`, values, title),
    roast: pickTopicCopy(COPY_POOLS.roast, `${title}:roast`, values, title),
    random: `${title}今天主打${keywords}；運勢不差，但拖延症若上線，宇宙也救不了你的進度條。`
  };
}

const BAGUA_RESULTS = TRIGRAM_ORDER.flatMap((upper) => {
  return TRIGRAM_ORDER.map((lower, index) => {
    const [title, keywords] = HEXAGRAM_MATRIX[upper][index];
    return {
      key: `bagua_${lower}_${upper}`,
      title,
      keywords,
      lines: [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines],
      text: baguaText(title, keywords)
    };
  });
});

const TAROT_CARDS = [
  ['fool', '愚者', '◇', ['開始、冒險、自由', '衝動、冒失、迷路'], ['先衝再說', '看路再跳']],
  ['magician', '魔術師', '✦', ['能力、創造、行動', '空談、欺瞞、拖延'], ['技能上線', '魔法失靈']],
  ['high_priestess', '女祭司', '☾', ['直覺、觀察、智慧', '迷惘、誤判、封閉'], ['先觀察', '訊號雜訊']],
  ['empress', '皇后', '✿', ['豐盛、成長、照顧', '放縱、依賴、停滯'], ['穩定滋養', '養過頭了']],
  ['emperor', '皇帝', '♜', ['秩序、權威、掌控', '固執、控制、失衡'], ['建立規則', '管太多了']],
  ['hierophant', '教皇', '⚜', ['傳統、學習、指引', '叛逆、質疑、偏離'], ['遵循經驗', '自己定義']],
  ['lovers', '戀人', '♡', ['選擇、連結、契合', '猶豫、失衡、分歧'], ['雙向奔赴', '訊號不合']],
  ['chariot', '戰車', '➤', ['前進、意志、勝利', '失控、停滯、偏航'], ['全速前進', '方向跑掉']],
  ['strength', '力量', '∞', ['勇氣、耐心、自制', '膽怯、失衡、焦躁'], ['溫柔強大', '信心掉線']],
  ['hermit', '隱者', '✧', ['沉思、探索、內省', '封閉、孤立、逃避'], ['獨自思考', '躲太久了']],
  ['wheel', '命運之輪', '◌', ['轉機、循環、機會', '延遲、反覆、低潮'], ['好運轉動', '卡住一圈']],
  ['justice', '正義', '⚖', ['公平、選擇、結果', '偏見、失衡、推責'], ['帳該算了', '理由很多']],
  ['hanged_man', '吊人', '🙃', ['等待、轉念、觀察', '拖延、固執、停滯'], ['換個角度', '不肯下來']],
  ['death', '死神', '☠', ['結束、轉變、重生', '抗拒、停滯、執著'], ['版本更新', '舊版本']],
  ['temperance', '節制', '🏺', ['平衡、協調、穩定', '失衡、過度、混亂'], ['剛剛好', '過頭了']],
  ['devil', '惡魔', '😈', ['誘惑、執著、慾望', '解脫、覺醒、鬆綁'], ['很想要', '自由了']],
  ['tower', '高塔', '🗼', ['衝擊、真相、崩解', '逃避、延後、壓力'], ['炸開了', '快面對']],
  ['star', '星星', '⭐', ['希望、療癒、信心', '失望、懷疑、低潮'], ['有光了', '看不到']],
  ['moon', '月亮', '🌙', ['直覺、迷霧、未知', '真相、清晰、破解'], ['看不清', '看清了']],
  ['sun', '太陽', '☀', ['成功、快樂、活力', '延遲、低落、陰影'], ['發光中', '差一點']],
  ['judgement', '審判', '📯', ['覺醒、反思、重啟', '逃避、自責、停滯'], ['起床了', '還沒醒']],
  ['world', '世界', '🌍', ['完成、圓滿、成果', '未完成、缺口、延遲'], ['通關了', '快到了']]
];

function tarotText(card, orientation) {
  const isReversed = orientation === 'reversed';
  const state = isReversed ? '逆位' : '正位';
  const food = pickFood(`${card}:${state}`);
  const values = { card, state };
  return {
    love: pickTopicCopy(COPY_POOLS.love, `${card}:${state}:love`, values, `${card}${state}`),
    study: pickTopicCopy(TAROT_TOPIC_COPY_POOLS.study, `${card}:${state}:study`, values, `${card}${state}`),
    career: pickTopicCopy(COPY_POOLS.career, `${card}:${state}:career`, values, `${card}${state}`),
    money: pickTopicCopy(COPY_POOLS.money, `${card}:${state}:money`, values, `${card}${state}`),
    food: `${card}${state}叫你吃${food.name}。${food.line}`,
    travel: pickTopicCopy(TAROT_TOPIC_COPY_POOLS.travel, `${card}:${state}:travel`, values, `${card}${state}`),
    decision: pickTopicCopy(COPY_POOLS.decision, `${card}:${state}:decision`, values, `${card}${state}`),
    roast: pickTopicCopy(COPY_POOLS.roast, `${card}:${state}:roast`, values, `${card}${state}`),
    random: `${card}${state}今天來吐槽你：方向不是沒有，是你常常先跟拖延症私奔。`
  };
}

const TAROT_RESULTS = TAROT_CARDS.flatMap(([id, title, symbol, keywords, visualKeywords]) => {
  return ['upright', 'reversed'].map((orientation, index) => {
    const label = orientation === 'upright' ? '正位' : '逆位';
    return {
      key: `tarot_${id}_${orientation}`,
      base_key: `tarot_${id}`,
      title: `${title} ${label}`,
      keywords: keywords[index],
      orientation,
      visual: [title, symbol, visualKeywords[index]],
      text: tarotText(title, orientation)
    };
  });
});

module.exports = {
  BAGUA_RESULTS,
  FORTUNE_METHODS,
  FORTUNE_TOPIC_FALLBACKS,
  FORTUNE_TOPICS,
  TAROT_RESULTS
};
