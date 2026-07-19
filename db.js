let _config = null;

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: (api.admin_password && api.admin_password !== 'admin1234') ? api.admin_password : (file.admin_password || 'love1219**')
  };
  return _config;
}

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToText(src) {
  if (!src) return '';
  let text = String(src);
  text = text.replace(/^---[\s\S]*?---\n?/, '');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/#{1,6}\s+/g, '');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');
  text = text.replace(/^\s*>+\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  return text.trim();
}

function renderMarkdown(src) {
  if (!src) return '';
  let str = String(src);
  str = str.replace(/^---[\s\S]*?---\n?/, '');

  let codeBlocks = [];
  str = str.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    let idx = codeBlocks.length;
    codeBlocks.push('<pre class="bg-surface-container p-md rounded overflow-x-auto text-sm my-md"><code>' + escapeHtml(code.trim()) + '</code></pre>');
    return '___CODEBLOCK_' + idx + '___';
  });

  let inlineCodes = [];
  let parts = str.split('`');
  let newStr = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      let idx = inlineCodes.length;
      inlineCodes.push('<code class="bg-surface-container px-xs py-[2px] rounded text-sm font-mono text-primary">' + escapeHtml(parts[i]) + '</code>');
      newStr += '___INLINECODE_' + idx + '___';
    } else {
      newStr += parts[i];
    }
  }
  str = newStr;

  let lines = str.split('\n');
  let htmlLines = [];
  let inList = false;
  let listType = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();

    if (trimmed.startsWith('___CODEBLOCK_')) {
      if (inList) { htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      let cbIdx = parseInt(trimmed.replace('___CODEBLOCK_', '').replace('___', ''));
      htmlLines.push(codeBlocks[cbIdx] || '');
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      if (inList) { htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      htmlLines.push('<hr class="my-lg border-hairline" />');
      continue;
    }

    let headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      if (inList) { htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      let level = headerMatch[1].length;
      let title = parseInlineElements(escapeHtml(headerMatch[2]));
      let classes = {
        1: 'font-display-lg text-display-lg font-bold my-lg text-on-surface',
        2: 'font-headline-md text-headline-md font-bold mt-xl mb-md text-on-surface',
        3: 'font-headline-sm text-headline-sm font-semibold mt-lg mb-sm text-on-surface',
        4: 'font-headline-sm text-[16px] font-semibold mt-md mb-xs text-on-surface',
        5: 'font-body-lg text-[15px] font-bold mt-sm mb-xs text-on-surface',
        6: 'font-body-md text-[14px] font-bold mt-sm mb-xs text-on-surface'
      };
      htmlLines.push('<h' + level + ' class="' + (classes[level] || '') + '">' + title + '</h' + level + '>');
      continue;
    }

    if (trimmed.startsWith('>')) {
      if (inList) { htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      let quoteContent = parseInlineElements(escapeHtml(trimmed.replace(/^>\s?/, '')));
      htmlLines.push('<blockquote class="border-l-4 border-primary pl-md py-xs my-md bg-surface-container/50 text-on-surface-variant italic">' + quoteContent + '</blockquote>');
      continue;
    }

    let ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    let olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

    if (ulMatch || olMatch) {
      let currentType = ulMatch ? 'ul' : 'ol';
      let itemContent = parseInlineElements(escapeHtml(ulMatch ? ulMatch[1] : olMatch[2]));
      if (!inList || listType !== currentType) {
        if (inList) { htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>'); }
        htmlLines.push(currentType === 'ul' ? '<ul class="list-disc pl-lg space-y-xs my-md">' : '<ol class="list-decimal pl-lg space-y-xs my-md">');
        inList = true;
        listType = currentType;
      }
      htmlLines.push('<li>' + itemContent + '</li>');
      continue;
    } else {
      if (inList) {
        htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
      }
    }

    if (trimmed === '') {
      continue;
    }

    let parsedLine = parseInlineElements(escapeHtml(line));
    htmlLines.push('<p class="leading-relaxed mb-md text-on-surface-variant">' + parsedLine + '</p>');
  }

  if (inList) {
    htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  let finalHtml = htmlLines.join('\n');

  finalHtml = finalHtml.replace(/___INLINECODE_(\d+)___/g, function(_, idx) {
    return inlineCodes[parseInt(idx)] || '';
  });

  return finalHtml;
}

function parseInlineElements(text) {
  let result = text;
  result = result.replace(/(\*\*|__)(.*?)\1/g, '<strong class="font-bold text-on-surface">$2</strong>');
  result = result.replace(/(\*|_)(.*?)\1/g, '<em class="italic">$2</em>');
  result = result.replace(/~~(.*?)~~/g, '<del class="line-through">$1</del>');
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:opacity-80 transition-opacity">$1</a>');
  return result;
}

async function getPosts() {
  let cached = localStorage.getItem('realty_posts');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }
  try {
    let res = await fetch('data/posts.json');
    if (res.ok) {
      let posts = await res.json();
      localStorage.setItem('realty_posts', JSON.stringify(posts));
      return posts;
    }
  } catch(e) {}
  return [];
}

async function getPostById(id) {
  let posts = await getPosts();
  return posts.find(p => String(p.id) === String(id)) || null;
}

async function savePost(postData) {
  let posts = await getPosts();
  let id = postData.id;
  if (!id) {
    id = String(Date.now());
    postData.id = id;
  }
  if (!postData.date) {
    let now = new Date();
    postData.date = now.toISOString().split('T')[0];
  }
  let index = posts.findIndex(p => String(p.id) === String(id));
  if (index >= 0) {
    posts[index] = { ...posts[index], ...postData };
  } else {
    posts.unshift(postData);
  }

  localStorage.setItem('realty_posts', JSON.stringify(posts));

  try {
    let cfg = await loadConfig();
    let token = String(cfg.github_token || '').replace(/\s+/g, '');
    let owner = cfg.github_owner;
    let repo = cfg.github_repo;
    let path = cfg.data_file_path || 'data/posts.json';

    if (token && token !== 'YOUR_GITHUB_TOKEN' && owner && repo) {
      let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      let getRes = await fetch(url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      let sha = '';
      if (getRes.ok) {
        let fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }
      let contentStr = JSON.stringify(posts, null, 2);
      let bytes = new TextEncoder().encode(contentStr);
      let binary = '';
      for (let b of bytes) binary += String.fromCharCode(b);
      let base64Content = btoa(binary);

      let bodyObj = {
        message: `feat(board): update ${path} via admin panel`,
        content: base64Content
      };
      if (sha) bodyObj.sha = sha;

      let putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyObj)
      });
      if (!putRes.ok) {
        console.warn('GitHub API Sync status:', putRes.status);
      }
    }
  } catch(err) {
    console.error('GitHub Sync Error:', err);
  }

  return postData;
}

async function deletePost(id) {
  let posts = await getPosts();
  let filtered = posts.filter(p => String(p.id) !== String(id));
  localStorage.setItem('realty_posts', JSON.stringify(filtered));

  try {
    let cfg = await loadConfig();
    let token = String(cfg.github_token || '').replace(/\s+/g, '');
    let owner = cfg.github_owner;
    let repo = cfg.github_repo;
    let path = cfg.data_file_path || 'data/posts.json';

    if (token && token !== 'YOUR_GITHUB_TOKEN' && owner && repo) {
      let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      let getRes = await fetch(url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        let fileInfo = await getRes.json();
        let sha = fileInfo.sha;
        let contentStr = JSON.stringify(filtered, null, 2);
        let bytes = new TextEncoder().encode(contentStr);
        let binary = '';
        for (let b of bytes) binary += String.fromCharCode(b);
        let base64Content = btoa(binary);

        await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `delete(board): remove post ${id}`,
            content: base64Content,
            sha: sha
          })
        });
      }
    }
  } catch(err) {
    console.error('GitHub Sync Delete Error:', err);
  }
}

/* ==========================================================================
   매물 (Properties) CRUD 기능
   ========================================================================== */

/* ==========================================================================
   매물 (Properties) CRUD 기능 (Supabase DB 연동)
   ========================================================================== */

const SUPABASE_URL = "https://ukcbvzyyfzwqotvareil.supabase.co";
const SUPABASE_KEY = "sb_publishable_7ckpmsNs6bQJKtALe898vw_hu0v2xF1";

async function getProperties() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const props = await res.json();
      if (Array.isArray(props) && props.length > 0) {
        localStorage.setItem('realty_properties', JSON.stringify(props));
        return props;
      }
    }
  } catch (e) {
    console.warn('Supabase Fetch Error, fallbacking to local:', e);
  }

  // Fallback to local cache or properties.json
  let cached = localStorage.getItem('realty_properties');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }
  try {
    let res = await fetch('data/properties.json');
    if (res.ok) {
      let props = await res.json();
      localStorage.setItem('realty_properties', JSON.stringify(props));
      return props;
    }
  } catch(e) {}
  return [];
}

async function getPropertyById(id) {
  let props = await getProperties();
  return props.find(p => String(p.id) === String(id)) || null;
}

async function saveProperty(propertyData) {
  let id = propertyData.id || ('prop-' + Date.now());
  propertyData.id = id;
  if (!propertyData.date) {
    propertyData.date = new Date().toISOString().split('T')[0];
  }

  // 1. Supabase DB 저장 (UPSERT)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify([propertyData])
    });
  } catch (err) {
    console.error('Supabase Save Property Error:', err);
  }

  // 2. 로컬 캐시 업데이트
  let props = await getProperties();
  let index = props.findIndex(p => String(p.id) === String(id));
  if (index >= 0) {
    props[index] = { ...props[index], ...propertyData };
  } else {
    props.unshift(propertyData);
  }
  localStorage.setItem('realty_properties', JSON.stringify(props));

  return propertyData;
}

async function deleteProperty(id) {
  // 1. Supabase DB 삭제
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
  } catch (err) {
    console.error('Supabase Delete Property Error:', err);
  }

  // 2. 로컬 캐시 갱신
  let props = await getProperties();
  let filtered = props.filter(p => String(p.id) !== String(id));
  localStorage.setItem('realty_properties', JSON.stringify(filtered));
}

/* ==========================================================================
   부동산뱅크 엑셀 및 텍스트 스마트 파서 헬퍼
   ========================================================================== */

function mapExcelRowToProperty(row) {
  if (!row) return null;

  const getCol = (names) => {
    for (let k of Object.keys(row)) {
      for (let n of names) {
        if (k.trim().toLowerCase().includes(n.toLowerCase())) {
          return String(row[k] || '').trim();
        }
      }
    }
    return '';
  };

  const title = getCol(['매물명', '매물제목', '제목', '아파트명', '단지명', '부동산명']) || '잠실 매물';
  const category = getCol(['단지종류', '단지명', '카테고리', '부동산종류', '매물종류']) || (title.includes('엘스') ? '엘스' : (title.includes('트리지움') ? '트리지움' : '리센츠'));
  const tradeType = getCol(['거래유형', '거래구분', '거래종류', '유형']) || '매매';
  const price = getCol(['가격', '매매가', '보증금', '금액', '매매가/보증금']) || '가격 문의';
  const size = getCol(['면적', '공급면적', '전용면적', '평형']) || '공급 109.99㎡ / 전용 84.99㎡';
  const floor = getCol(['층수', '해당층', '층', '층수/총층']) || '중층';
  const dongFloor = getCol(['동층', '해당동', '동']) ? `${getCol(['동층', '해당동', '동'])} ${floor}` : floor;
  const roomBath = getCol(['방수', '구조', '방수/욕실수']) || '방 3개 / 욕실 2개';
  const maintenance = getCol(['관리비']) || '약 25만원';
  const prevDeposit = getCol(['기보증금', '기보증금/월세']) || '-';
  const direction = getCol(['방향']) || '남향';
  const entrance = getCol(['현관구조', '현관']) || '계단식';
  const heating = getCol(['난방', '난방방식']) || '지역난방 / 열병합';
  const moveInDate = getCol(['입주가능일', '입주일', '입주']) || '즉시입주 (협의가능)';
  const parking = getCol(['주차', '주차대수']) || '세대당 1.3대';
  const households = getCol(['세대수']) || '1,200세대';
  const buildingUse = getCol(['건축물용도', '용도']) || '공동주택';
  const approvalDate = getCol(['사용승인일', '준공일']) || '2008년 7월';
  const address = getCol(['주소', '소재지']) || '서울특별시 송파구 잠실동';
  const description = getCol(['상세설명', '매물설명', '특징설명', '설명']) || title;
  const image = getCol(['사진', '이미지', '대표사진']) || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';

  return {
    id: 'excel-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    title,
    category,
    tradeType,
    dongFloor,
    price,
    size,
    floor,
    roomBath,
    maintenance,
    prevDeposit,
    direction,
    entrance,
    heating,
    moveInDate,
    parking,
    households,
    buildingUse,
    approvalDate,
    address,
    description,
    features: ['부동산뱅크실매물', tradeType, category, '역세권'],
    image,
    date: new Date().toISOString().split('T')[0],
    agentContact: '02-415-8949'
  };
}

function parseRawTextToProperty(text) {
  if (!text) throw new Error('텍스트가 비어 있습니다.');

  let tradeType = '매매';
  if (text.includes('전세')) tradeType = '전세';
  else if (text.includes('월세')) tradeType = '월세';
  else if (text.includes('단기')) tradeType = '단기임대';

  let category = '리센츠';
  if (text.includes('엘스')) category = '엘스';
  else if (text.includes('트리지움')) category = '트리지움';
  else if (text.includes('상가') || text.includes('사무실')) category = '상가/사무실';
  else if (text.includes('오피스텔')) category = '오피스텔';

  let priceMatch = text.match(/(\d+억\s*\d*천?만?|\d+천만?|\d+만)/);
  let price = priceMatch ? priceMatch[0] : '25억 5,000만';

  let sizeMatch = text.match(/(\d+평|\d+㎡|\d+\/\d+)/);
  let size = sizeMatch ? `공급 ${sizeMatch[0]} / 전용 84.99㎡` : '공급 109.99㎡ / 전용 84.99㎡ (33평)';

  let dongMatch = text.match(/(\d+동)/);
  let floorMatch = text.match(/(\d+층|고층|중층|저층)/);
  let dongFloor = (dongMatch ? dongMatch[0] + ' ' : '') + (floorMatch ? floorMatch[0] : '18층');

  let dirMatch = text.match(/(남향|동향|서향|북향|남동향|남서향)/);
  let direction = dirMatch ? dirMatch[0] : '남향';

  return {
    id: 'text-' + Date.now(),
    title: text.slice(0, 45).trim(),
    category,
    tradeType,
    dongFloor,
    price,
    size,
    floor: floorMatch ? floorMatch[0] : '18층',
    roomBath: '방 3개 / 욕실 2개',
    maintenance: '약 25만원',
    prevDeposit: '-',
    direction,
    entrance: '계단식',
    heating: '지역난방 / 열병합',
    moveInDate: '즉시입주 (협의가능)',
    parking: '세대당 1.3대',
    households: '1,200세대',
    buildingUse: '공동주택',
    approvalDate: '2008년 7월',
    address: '서울특별시 송파구 올림픽로 135 (잠실동)',
    description: text,
    features: ['스마트파싱등록', tradeType, category, direction],
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    date: new Date().toISOString().split('T')[0],
    agentContact: '02-415-8949'
  };
}

