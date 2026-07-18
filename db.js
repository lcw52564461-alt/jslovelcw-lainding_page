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
    admin_password: api.admin_password || file.admin_password || 'love1219**'
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

async function getProperties() {
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
  let props = await getProperties();
  let id = propertyData.id;
  if (!id) {
    id = 'prop-' + Date.now();
    propertyData.id = id;
  }
  if (!propertyData.date) {
    let now = new Date();
    propertyData.date = now.toISOString().split('T')[0];
  }
  let index = props.findIndex(p => String(p.id) === String(id));
  if (index >= 0) {
    props[index] = { ...props[index], ...propertyData };
  } else {
    props.unshift(propertyData);
  }

  localStorage.setItem('realty_properties', JSON.stringify(props));

  try {
    let cfg = await loadConfig();
    let token = String(cfg.github_token || '').replace(/\s+/g, '');
    let owner = cfg.github_owner;
    let repo = cfg.github_repo;
    let path = 'data/properties.json';

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
      let contentStr = JSON.stringify(props, null, 2);
      let bytes = new TextEncoder().encode(contentStr);
      let binary = '';
      for (let b of bytes) binary += String.fromCharCode(b);
      let base64Content = btoa(binary);

      let bodyObj = {
        message: `feat(property): update ${path} via admin panel`,
        content: base64Content
      };
      if (sha) bodyObj.sha = sha;

      await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyObj)
      });
    }
  } catch(err) {
    console.error('GitHub Sync Property Error:', err);
  }

  return propertyData;
}

async function deleteProperty(id) {
  let props = await getProperties();
  let filtered = props.filter(p => String(p.id) !== String(id));
  localStorage.setItem('realty_properties', JSON.stringify(filtered));

  try {
    let cfg = await loadConfig();
    let token = String(cfg.github_token || '').replace(/\s+/g, '');
    let owner = cfg.github_owner;
    let repo = cfg.github_repo;
    let path = 'data/properties.json';

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
            message: `delete(property): remove property ${id}`,
            content: base64Content,
            sha: sha
          })
        });
      }
    }
  } catch(err) {
    console.error('GitHub Sync Property Delete Error:', err);
  }
}

