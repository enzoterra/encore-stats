import os, sys, hashlib
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT + '/ttf', exist_ok=True); os.makedirs(OUT + '/woff2', exist_ok=True)

# Latin + Latin Extended (PT-BR, EN, e nomes europeus) + pontuação tipográfica usada na UI/cards
LATIN = ("U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
         "U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2605,U+266A,U+FEFF,U+FFFD")
LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

def unicodes(spec):
    out=set()
    for part in spec.split(','):
        part=part.strip().replace('U+','')
        if '-' in part:
            a,b=part.split('-'); out.update(range(int(a,16),int(b,16)+1))
        else: out.add(int(part,16))
    return out

def rename(font, family, style):
    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (1,2,4,6,16,17): name.removeNames(nameID=rec.nameID)
    full = f"{family} {style}"
    name.setName(family, 1, 3, 1, 0x409); name.setName(style if style in ('Regular','Bold') else 'Regular', 2, 3, 1, 0x409)
    name.setName(full, 4, 3, 1, 0x409); name.setName(full.replace(' ', '-'), 6, 3, 1, 0x409)
    name.setName(family, 16, 3, 1, 0x409); name.setName(style, 17, 3, 1, 0x409)

def static(src, loc, family, style, wght, out):
    f = TTFont(src)
    f = instancer.instantiateVariableFont(f, loc, updateFontNames=False)
    rename(f, family, style)
    f['OS/2'].usWeightClass = wght
    f.save(out); return out

def subset_to(src, out, flavor=None, spec=LATIN+','+LATIN_EXT):
    opts = subset.Options(); opts.flavor = flavor; opts.layout_features = ['*']; opts.name_IDs=['*']; opts.notdef_outline=True
    opts.drop_tables += ['DSIG']
    f = TTFont(src); s = subset.Subsetter(opts); s.populate(unicodes=unicodes(spec)); s.subset(f)
    f.flavor = flavor; f.save(out)

B = SRC + '/BricolageGrotesque-VF.ttf'; I = SRC + '/Inter-VF.ttf'
T = OUT + '/ttf'
# --- TTF estáticos para satori (satori não lê fontes variáveis nem WOFF2) ---
jobs = [
  (B, {'wght':800,'wdth':100,'opsz':96}, 'Bricolage Grotesque', 'ExtraBold', 800, 'BricolageGrotesque-ExtraBold.ttf'),
  (B, {'wght':600,'wdth':100,'opsz':96}, 'Bricolage Grotesque', 'SemiBold', 600, 'BricolageGrotesque-SemiBold.ttf'),
  (B, {'wght':800,'wdth':75,'opsz':96}, 'Bricolage Grotesque Condensed', 'ExtraBold', 800, 'BricolageGrotesqueCondensed-ExtraBold.ttf'),
  (I, {'wght':400,'opsz':28}, 'Inter', 'Regular', 400, 'Inter-Regular.ttf'),
  (I, {'wght':600,'opsz':28}, 'Inter', 'SemiBold', 600, 'Inter-SemiBold.ttf'),
  (I, {'wght':700,'opsz':28}, 'Inter', 'Bold', 700, 'Inter-Bold.ttf'),
]
tmp = OUT + '/_tmp.ttf'
for src, loc, fam, sty, w, name in jobs:
    static(src, loc, fam, sty, w, tmp)
    # Bricolage cobre Latin/Latin-Ext/Vietnamita: sem subset. Inter: mantém Latin+Ext+Cirílico+Grego (nomes de artistas).
    spec = LATIN+','+LATIN_EXT + (',U+0370-03FF,U+0400-052F,U+1F00-1FFF,U+2DE0-2DFF,U+A640-A69F,U+1C80-1C8F,U+1EA0-1EF9' if src==I else ',U+1EA0-1EF9')
    subset_to(tmp, T + '/' + name, None, spec)
os.remove(tmp)

# --- WOFF2 variáveis para a web (eixos restritos aos intervalos usados) ---
wb = instancer.instantiateVariableFont(TTFont(B), {'wght':(500,800),'wdth':(75,100),'opsz':(12,96)}); wb.save(tmp)
subset_to(tmp, OUT + '/woff2/BricolageGrotesque-VF-latin.woff2', 'woff2')
wi = instancer.instantiateVariableFont(TTFont(I), {'wght':(400,700),'opsz':(14,32)}); wi.save(tmp)
subset_to(tmp, OUT + '/woff2/Inter-VF-latin.woff2', 'woff2')
os.remove(tmp)

for d in ('ttf','woff2'):
    for n in sorted(os.listdir(OUT+'/'+d)):
        p = OUT+'/'+d+'/'+n; data=open(p,'rb').read()
        print(f"{d}/{n}\t{len(data)//1024} KB\tsha256:{hashlib.sha256(data).hexdigest()[:16]}")
