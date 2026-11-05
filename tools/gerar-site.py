#!/usr/bin/env python3
"""Gera as páginas de leitura do site (docs/*.html) a partir dos textos em Markdown da pasta docs/.

  docs/ferramentas.md                 → docs/manual.html
  docs/guia-do-mestre.md + jogador    → docs/guias.html
  docs/instalacao.md + -linux.md      → docs/instalar.html
  docs/novidades.md                   → docs/novidades.html

Os .md continuam sendo a fonte (e também são lidos direto no GitHub). Depois de mexer neles, rode:
    python3 tools/gerar-site.py
Precisa do pacote "markdown" do Python (pip install markdown).
"""
import html
import os
import re
import sys

import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')
REPO = 'https://github.com/LP-IQ/tabula'

ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII',
         'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV']


def slugify(value, sep='-'):
    """o mesmo formato de âncora do GitHub (os .md já usam esses links)"""
    s = value.strip().lower()
    s = re.sub(r'[^\w\- ]', '', s)
    return s.replace(' ', sep)


# para onde vai cada link dos .md quando vira site
PAGE_OF = {
    'ferramentas.md': ('manual.html', ''),
    'guia-do-mestre.md': ('guias.html', 'mestre-'),
    'guia-do-jogador.md': ('guias.html', 'jogador-'),
    'instalacao.md': ('instalar.html', 'win-'),
    'instalacao-linux.md': ('instalar.html', 'lin-'),
    'novidades.md': ('novidades.html', ''),
}
PART_ANCHOR = {'guia-do-mestre.md': 'mestre', 'guia-do-jogador.md': 'jogador', 'instalacao.md': 'windows',
               'instalacao-linux.md': 'linux'}


def rewrite_links(body, prefix):
    def fix(m):
        href = m.group(1)
        if href.startswith('#'):
            return f'href="#{prefix}{href[1:]}"'
        if href.startswith(('http:', 'https:', 'mailto:')):
            return m.group(0)
        if href.startswith('../'):
            return f'href="{REPO}/blob/main/{href[3:]}"'
        file, _, anchor = href.partition('#')
        if file in PAGE_OF:
            page, pre = PAGE_OF[file]
            if anchor:
                return f'href="{page}#{pre}{anchor}"'
            return f'href="{page}#{PART_ANCHOR[file]}"' if file in PART_ANCHOR else f'href="{page}"'
        if file.endswith('.md'):
            return f'href="{REPO}/blob/main/docs/{href}"'
        return m.group(0)
    return re.sub(r'href="([^"]+)"', fix, body)


FLEURON = ('<svg class="fleuron" viewBox="0 0 180 18" aria-hidden="true"><path d="M0 9h70M110 9h70" stroke="currentColor"/>'
           '<path d="M90 1l8 8-8 8-8-8z" fill="none" stroke="currentColor"/><circle cx="90" cy="9" r="2" fill="#a8321f"/>'
           '<circle cx="76" cy="9" r="1.6" fill="currentColor"/><circle cx="104" cy="9" r="1.6" fill="currentColor"/></svg>')


def convert(md_text, prefix='', numbers=True):
    """md → (título, abertura, corpo, capítulos[(id, título, [(id, subtítulo)])])"""
    md_text = re.sub(r'^\*\*Sumário:\*\*.*?(?=\n\n)', '', md_text, flags=re.S | re.M)  # o site tem o próprio sumário
    m = markdown.Markdown(extensions=['tables', 'fenced_code', 'sane_lists', 'toc'],
                          extension_configs={'toc': {'slugify': lambda v, s: prefix + slugify(v, s)}})
    out = m.convert(md_text)
    title = ''
    mt = re.search(r'<h1[^>]*>(.*?)</h1>', out, re.S)
    if mt:
        title = re.sub('<[^>]+>', '', mt.group(1))
        out = out[:mt.start()] + out[mt.end():]
    first_h2 = out.find('<h2')
    lede, body = (out[:first_h2], out[first_h2:]) if first_h2 >= 0 else ('', out)
    lede = re.sub(r'<hr\s*/?>', '', lede).strip()
    body = re.sub(r'\s*<hr\s*/?>\s*', '\n', body)
    body = rewrite_links(body, prefix)
    lede = rewrite_links(lede, prefix)
    body = re.sub(r'<table>', '<div class="table-scroll"><table>', body).replace('</table>', '</table></div>')
    body = re.sub(r'(</h2>\s*(?:<img[^>]*>\s*)?)<p>', r'\1<p class="dropcap">', body)
    # capítulos e seções para o sumário
    chapters = []
    for h in re.finditer(r'<h([23]) id="([^"]+)">(.*?)</h\1>', body, re.S):
        text = html.unescape(re.sub('<[^>]+>', '', h.group(3))).strip()
        if h.group(1) == '2':
            chapters.append((h.group(2), text, []))
        elif chapters:
            chapters[-1][2].append((h.group(2), text))
    # número do capítulo e ornamento entre eles
    n = [0]

    def numbered(mh):
        n[0] += 1
        orn = FLEURON if n[0] > 1 else ''
        num = f'<span class="chap-n" aria-hidden="true">Capítulo {ROMAN[n[0] - 1]}</span>' if numbers else ''
        return f'{orn}<h2 id="{mh.group(1)}">{num}{mh.group(2)}</h2>'
    body = re.sub(r'<h2 id="([^"]+)">(.*?)</h2>', numbered, body, flags=re.S)
    # imagens largas dos .md (width=640) ficam numa moldura simples
    body = re.sub(r'<img ([^>]*?)width="(\d+)"([^>]*)>', lambda mi: f'<img {mi.group(1)}width="{mi.group(2)}"{mi.group(3)} class="{"side" if "align=" in mi.group(0) else "wide"}" loading="lazy">', body)
    return title, lede, body, chapters


NAV = [('index.html', 'Início'), ('manual.html', 'Manual'), ('guias.html', 'Guias'), ('instalar.html', 'Instalar'),
       ('novidades.html', 'Novidades')]
BRAND = ('<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 29 9.5v13L16 30 3 22.5v-13z" fill="#c9a13b"/>'
         '<path d="M16 7 25 22H7z" fill="#131f3e"/></svg>')


def bar(current):
    links = ''.join(
        f'<a href="{href}"{" aria-current=page" if href == current else ""}{" class=wide" if href == "guias.html" else ""}>{label}</a>'
        for href, label in NAV)
    return (f'<header class="bar"><div class="wrap"><a class="brand" href="index.html">{BRAND}Tábula</a>'
            f'<nav aria-label="Páginas">{links}<a class="wide" href="{REPO}">GitHub</a></nav></div></header>')


COLOPHON = f'''<footer class="colophon"><div class="wrap">
  <div><a class="brand" href="index.html">{BRAND}Tábula</a>
    <p>Mesa virtual feita para uma campanha de D&amp;D 5e, de código aberto. Os textos deste site também estão na pasta
    <code>docs</code> do <a href="{REPO}">repositório</a>.</p></div>
  <div><p>Monstros, magias e itens vêm do System Reference Document 5.1 da Wizards of the Coast, licença
    <a href="https://creativecommons.org/licenses/by/4.0/legalcode">CC-BY-4.0</a>; a tradução é da Tábula. A vista 3D usa o
    <a href="https://threejs.org">three.js</a> (MIT). A Tábula não é afiliada à Wizards of the Coast.</p></div>
</div></footer>'''

HEAD = '''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Tábula</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title} — Tábula">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://lp-iq.github.io/tabula/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 2 29 9.5v13L16 30 3 22.5v-13z' fill='%23c9a13b'/%3E%3Cpath d='M16 7 25 22H7z' fill='%23131f3e'/%3E%3C/svg%3E">
<link rel="stylesheet" href="site.css">
<link rel="stylesheet" href="livro.css">
</head>
<body>
<a class="skip" href="#texto">Pular para o texto</a>
'''


def toc_html(parts, numbers=True):
    """parts = [(título da parte ou None, capítulos)]"""
    out = []
    for part_title, part_id, chapters in parts:
        if part_title:
            out.append(f'<p class="toc-part"><a href="#{part_id}">{html.escape(part_title)}</a></p>')
        items = []
        for i, (cid, text, subs) in enumerate(chapters):
            sub = ''
            if subs:
                sub = '<ol class="toc-sub">' + ''.join(f'<li><a href="#{sid}">{html.escape(st)}</a></li>' for sid, st in subs) + '</ol>'
            items.append(f'<li data-id="{cid}"><a href="#{cid}"><span class="toc-n">{ROMAN[i] if numbers else "·"}</span>'
                         f'<span class="toc-t">{html.escape(text)}</span></a>{sub}</li>')
        out.append('<ol class="toc-list">' + ''.join(items) + '</ol>')
    return '\n'.join(out)


SCRIPT = '''<script>
(() => {
  // marca no sumário o capítulo que está na tela e abre as seções dele
  const links = new Map([...document.querySelectorAll('.toc-list > li')].map((li) => [li.dataset.id, li]));
  const heads = [...document.querySelectorAll('.page h2[id]')];
  let current = null;
  const spy = () => {
    let best = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top < 140) best = h;
    const li = best && links.get(best.id);
    if (li && li !== current) {
      current?.classList.remove('on');
      li.classList.add('on');
      current = li;
      const toc = document.querySelector('.toc-scroll');
      if (toc && matchMedia('(min-width: 961px)').matches) {
        const r = li.getBoundingClientRect(), t = toc.getBoundingClientRect();
        if (r.top < t.top || r.bottom > t.bottom) toc.scrollTop += r.top - t.top - 80;
      }
    }
  };
  addEventListener('scroll', spy, { passive: true });
  spy();
  // procurar: deixa no sumário só os capítulos com a palavra (no título ou no texto)
  const q = document.getElementById('toc-q');
  if (q) {
    const text = new Map(heads.map((h) => {
      let s = h.textContent, el = h.nextElementSibling;
      while (el && el.tagName !== 'H2' && !el.matches('svg.fleuron')) { s += ' ' + el.textContent; el = el.nextElementSibling; }
      return [h.id, s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()];
    }));
    const empty = document.getElementById('toc-empty');
    q.addEventListener('input', () => {
      const w = q.value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
      let shown = 0;
      for (const [id, li] of links) {
        const ok = !w || text.get(id)?.includes(w);
        li.hidden = !ok;
        shown += ok;
      }
      for (const p of document.querySelectorAll('.toc-part')) p.hidden = !!w;
      empty.hidden = shown > 0;
    });
  }
  // no celular, escolher um capítulo fecha o sumário
  const box = document.querySelector('.toc');
  if (box && matchMedia('(max-width: 960px)').matches) box.open = false;   // no celular começa fechado
  box?.addEventListener('click', (e) => { if (e.target.closest('a') && box.open !== undefined && matchMedia('(max-width: 960px)').matches) box.open = false; });
})();
</script>'''


def build(out_name, title, desc, lede_html, parts, search=True, numbers=True):
    """parts = [(título da parte, id, corpo, capítulos)]"""
    toc = toc_html([(t, pid, ch) for t, pid, _, ch in parts], numbers)
    bodies = []
    for t, pid, body, _ in parts:
        if t:
            bodies.append(f'<h1 class="part" id="{pid}">{html.escape(t)}</h1>')
        bodies.append(body)
    search_box = ('<label class="toc-q"><span>Procurar</span><input id="toc-q" type="search" placeholder="névoa, multiclasse, dados…" '
                  'autocomplete="off"></label><p id="toc-empty" class="toc-empty" hidden>Nada com essa palavra.</p>') if search else ''
    page = HEAD.format(title=html.escape(title), desc=html.escape(desc)) + bar(out_name) + f'''
<div class="cover book-head"><div class="wrap">
  <h1>{html.escape(title)}</h1>
  <div class="lede">{lede_html}</div>
</div></div>
<div class="book wrap">
  <details class="toc" open>
    <summary>Sumário</summary>
    <div class="toc-scroll">{search_box}{toc}</div>
  </details>
  <main class="page deckle" id="texto">
    {''.join(bodies)}
  </main>
</div>
{COLOPHON}
{SCRIPT}
</body>
</html>
'''
    with open(os.path.join(DOCS, out_name), 'w', encoding='utf-8') as fh:
        fh.write(page)
    print('ok', out_name)


# Uma linha sobre cada capítulo do manual, para o sumário da página inicial
DESCR = {
    'mapa': 'Tokens com foto, PV e condições; zoom, arrasto e sinal no mapa.',
    'vista-3d': 'O mapa vira tabuleiro, com miniaturas .glb ou de papelão.',
    'ferramentas-do-mapa': 'Régua em metros, áreas de magia, desenho, setas e névoa de guerra.',
    'ficha': 'Atributos, perícias, PV pela classe, multiclasse, espaços de magia e descansos.',
    'equipamento-e-mochila': 'O boneco com os espaços do corpo; CA e ataques que se calculam sozinhos.',
    'dados': 'Rolagens com vantagem, rolagens ocultas do mestre e o histórico no chat.',
    'iniciativa': 'A ordem do combate, as rodadas e o turno de cada um no mapa.',
    'segredos-e-fila-de-memórias': 'Pistas e imagens para um jogador só, liberadas uma de cada vez.',
    'diário-e-compêndio': 'As anotações do grupo e as páginas de consulta do mestre.',
    'biblioteca-magias-e-itens': 'As 319 magias e os itens do SRD em português, prontos para a ficha.',
    'calendário-e-descansos-': 'A data do mundo, descanso curto e longo para o grupo inteiro.',
    'bestiário-': '334 monstros do SRD, ajuste de ND e o medidor de dificuldade do encontro.',
    'painel-do-mestre-': 'Cenas, contas dos jogadores, backups e o fim da sessão.',
    'atalhos-de-teclado': 'O que dá para fazer sem tirar a mão do teclado.',
}


def patch_index(chapters, releases):
    path = os.path.join(DOCS, 'index.html')
    with open(path, encoding='utf-8') as fh:
        page = fh.read()

    def put(name, content):
        nonlocal page
        page = re.sub(rf'<!-- gerado:{name} -->.*?<!-- /gerado -->', f'<!-- gerado:{name} -->\n{content}\n<!-- /gerado -->',
                      page, count=1, flags=re.S)
    items = []
    for i, (cid, text, _) in enumerate(chapters):
        gm = '👑' in text
        clean = re.sub(r'\s*\(👑\)|👑', '', text).strip()
        clean = re.sub(r'^[^\w]+', '', clean)
        d = DESCR.get(cid, '')
        items.append(f'<li><a href="manual.html#{cid}"><span>{html.escape(clean)}</span><span class="n">{ROMAN[i]}</span></a>'
                     f'<p>{html.escape(d)}{" <span class=gm>Só o mestre.</span>" if gm else ""}</p></li>')
    put('sumario', '<ol class="contents">' + ''.join(items) + '</ol>')
    rel = []
    for cid, text, _ in releases[:4]:
        m = re.match(r'(v[\d.]+)\s+—\s+(.*?)\s*\((.*?)\)\s*$', text)
        if not m:
            continue
        rel.append(f'<li><span class="v">{m.group(1)}</span><div><a href="novidades.html#{cid}">{html.escape(m.group(2))}</a>'
                   f'<small>{html.escape(m.group(3))}</small></div></li>')
    put('cronica', '<ol class="chronicle">' + ''.join(rel) + '</ol>')
    put('colofao', COLOPHON)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(page)
    print('ok index.html (sumário, crônica, colofão)')


def read(name):
    with open(os.path.join(DOCS, name), encoding='utf-8') as fh:
        return fh.read()


def main():
    t, lede, body, ch = convert(read('ferramentas.md'))
    manual_chapters = ch
    build('manual.html', 'Manual das ferramentas', 'Como usar cada parte da Tábula, do mapa à mochila, passo a passo.',
          lede, [(None, '', body, ch)])

    parts = []
    for name, pid in (('guia-do-mestre.md', 'mestre'), ('guia-do-jogador.md', 'jogador')):
        t, lede_p, body, ch = convert(read(name), PAGE_OF[name][1])
        parts.append((t, pid, (f'<div class="part-lede">{lede_p}</div>' if lede_p else '') + body, ch))
    build('guias.html', 'Guias da mesa', 'O resumo para o mestre e para os jogadores: o que fazer antes, durante e depois da sessão.',
          '<p>Dois resumos curtos: um para quem conduz a mesa, outro para quem joga. O passo a passo completo de cada '
          'ferramenta está no <a href="manual.html">manual</a>.</p>', parts)

    parts = []
    for name, pid in (('instalacao.md', 'windows'), ('instalacao-linux.md', 'linux')):
        t, lede_p, body, ch = convert(read(name), PAGE_OF[name][1])
        parts.append((t, pid, (f'<div class="part-lede">{lede_p}</div>' if lede_p else '') + body, ch))
    build('instalar.html', 'Instalar e abrir a mesa', 'Como instalar a Tábula no Windows, no Linux e no Mac, abrir a mesa e jogar online.',
          '<p>Só o mestre instala; os jogadores entram pelo navegador. Escolha o seu sistema: '
          '<a href="#windows">Windows</a> ou <a href="#linux">Linux e Mac</a>.</p>', parts, search=False)

    t, lede, body, ch = convert(read('novidades.md'), numbers=False)
    build('novidades.html', 'Novidades', 'O que chegou em cada versão da Tábula, e como experimentar.', lede, [(None, '', body, ch)],
          numbers=False)
    patch_index(manual_chapters, ch)


if __name__ == '__main__':
    sys.exit(main())
