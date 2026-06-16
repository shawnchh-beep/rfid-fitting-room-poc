const FORTUNE_TOPICS = {
  love: '姻緣',
  study: '學業',
  career: '事業',
  random: '隨便問'
};

const FORTUNE_METHODS = {
  bagua: '八卦占卜',
  tarot: '塔羅牌'
};

function sameText(text) {
  return {
    love: text,
    study: text,
    career: text,
    random: text
  };
}

const BAGUA_RESULTS = [
  {
    key: 'bagua_qian',
    title: '乾',
    keywords: '主動、開創、貴人',
    text: sameText('你最近的想法很多，而且每個都覺得能改變世界。理想很大不是問題，問題是如果一直停在腦內開會，再好的點子也只是在浪費電。挑一件事先做，別把自己活成簡報高手。')
  },
  {
    key: 'bagua_kun',
    title: '坤',
    keywords: '穩定、承接、等待',
    text: sameText('你最近有點像萬能工具人，什麼事都接、什麼忙都幫。善良很好，但別把自己用到沒電。適度拒絕不是自私，而是避免最後連自己都需要被救援。')
  },
  {
    key: 'bagua_zhen',
    title: '震',
    keywords: '變動、突破、驚醒',
    text: sameText('有些事情正在提醒你該動起來了。不是世界突然變快，而是你已經觀望太久。機會不一定會敲門，但它很可能已經在門口等到快不耐煩。')
  },
  {
    key: 'bagua_xun',
    title: '巽',
    keywords: '溝通、滲透、漸進',
    text: sameText('最近適合用腦勝過用力。硬衝不一定有用，換個角度反而比較快。別急著證明自己最厲害，先找到最省力的方法，畢竟人生不是體力測驗。')
  },
  {
    key: 'bagua_kan',
    title: '坎',
    keywords: '風險、情緒、阻礙',
    text: sameText('眼前的狀況有點複雜，但還沒複雜到值得你半夜失眠。先把問題拆小，一個一個解。別幻想一次解決所有事，超人也沒有這種服務項目。')
  },
  {
    key: 'bagua_li',
    title: '離',
    keywords: '看見、曝光、選擇',
    text: sameText('最近你的存在感有點強，別人容易注意到你。這是好事，但記得別把所有聚光燈都扛在身上。適時分享舞台，反而更容易得到真正的支持。')
  },
  {
    key: 'bagua_gen',
    title: '艮',
    keywords: '停止、觀察、守住',
    text: sameText('有些事情不是做得不夠多，而是做得太急。現在比較適合停一下檢查方向，而不是拼命踩油門。努力很重要，但開錯路的努力通常比較貴。')
  },
  {
    key: 'bagua_dui',
    title: '兌',
    keywords: '人際、喜悅、交換',
    text: sameText('最近的人際運不錯，但別把每個聊天都變成辯論賽。你可以贏得道理，卻輸掉氣氛。偶爾放過別人，也順便放過自己的血壓。')
  }
];

const TAROT_RESULTS = [
  {
    key: 'tarot_fool',
    title: '愚者',
    keywords: '開始、嘗試、冒險',
    text: sameText('你最近很想試新東西，這其實不錯。唯一要注意的是別把衝動誤認成勇氣。先確認腳下是不是樓梯，再帥氣地往前跳，成功率會高很多。')
  },
  {
    key: 'tarot_magician',
    title: '魔術師',
    keywords: '行動、創造、執行',
    text: sameText('你手上的資源其實比想像中多，只是平常習慣盯著缺少的部分。少研究一點如果，多做一點開始。很多事情不是缺能力，而是缺開工。')
  },
  {
    key: 'tarot_high_priestess',
    title: '女祭司',
    keywords: '直覺、觀察、思考',
    text: sameText('最近答案可能不在外面，而在你早就知道卻不想承認的地方。安靜觀察幾天，比急著問十個人的意見更有效，畢竟雜訊也是訊息的一種。')
  },
  {
    key: 'tarot_empress',
    title: '皇后',
    keywords: '成長、豐盛、照顧',
    text: sameText('這段時間適合培養與累積。別急著天天檢查成果，就像種子不會因為你一直挖起來看而長得比較快。耐心一點，收穫正在路上。')
  },
  {
    key: 'tarot_emperor',
    title: '皇帝',
    keywords: '規劃、秩序、掌控',
    text: sameText('你需要的不是更多靈感，而是更多規劃。腦中的藍圖已經夠華麗了，現在該處理的是執行細節。畢竟夢想再大，也得有人負責排進行程表。')
  },
  {
    key: 'tarot_lovers',
    title: '戀人',
    keywords: '選擇、連結、價值觀',
    text: sameText('最近可能會面臨選擇題，而且沒有完美答案。別一直期待天降提示。真正重要的不是選哪條路，而是選了之後願不願意好好走下去。')
  },
  {
    key: 'tarot_chariot',
    title: '戰車',
    keywords: '推進、決心、突破',
    text: sameText('事情正在往前推進，即使你覺得速度不夠快。別每五分鐘就檢查一次進度條。持續前進比頻繁懷疑自己更有幫助，導航也是這樣運作的。')
  },
  {
    key: 'tarot_strength',
    title: '力量',
    keywords: '韌性、耐心、自制',
    text: sameText('最近考驗的不是力量，而是耐性。有些人很想立刻看到結果，但世界通常沒那麼配合。穩穩撐住節奏，比情緒化地衝刺再放棄更有價值。')
  },
  {
    key: 'tarot_hermit',
    title: '隱者',
    keywords: '反思、沉澱、尋找',
    text: sameText('你可能需要一點獨處時間，不是逃避，而是整理。把外界的聲音先關小一點，你會發現很多問題其實早就有答案，只是平常太吵。')
  },
  {
    key: 'tarot_wheel',
    title: '命運之輪',
    keywords: '變化、機會、轉折',
    text: sameText('局勢正在變化，別急著把每個變動都當成危機。有時候命運轉動不是為了整你，而是提醒你該換個位置站。保持彈性比死守更重要。')
  },
  {
    key: 'tarot_star',
    title: '星星',
    keywords: '希望、方向、信心',
    text: sameText('最近適合把目光放遠一點。眼前的小麻煩確實存在，但別讓它霸佔整個畫面。你比自己想的更接近目標，只是還沒走到截圖分享的階段。')
  },
  {
    key: 'tarot_sun',
    title: '太陽',
    keywords: '成功、能量、樂觀',
    text: sameText('這是一張提醒你別太悲觀的牌。很多事情其實進展得不錯，只是你習慣先看缺點。偶爾接受自己做得還行，不會被課稅，也不會扣分。')
  }
];

module.exports = {
  BAGUA_RESULTS,
  FORTUNE_METHODS,
  FORTUNE_TOPICS,
  TAROT_RESULTS
};
