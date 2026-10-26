const { normalize } = require('./fuzzy');

// Common Brazilian pharmacy names (DCB-style active ingredients and widely sold brands).
// Not the full ANVISA/CMED catalog — a local aid for typos and brand→ingredient lookup.
const INGREDIENT_NAMES = `
Dipirona
Paracetamol
Ibuprofeno
Ácido acetilsalicílico
Diclofenaco
Nimesulida
Cetoprofeno
Naproxeno
Meloxicam
Piroxicam
Tenoxicam
Aceclofenaco
Celecoxibe
Etoricoxibe
Tramadol
Codeína
Morfina
Fentanila
Buprenorfina
Naloxona
Escopolamina
Cafeína
Orfenadrina
Carisoprodol
Ciclobenzaprina
Tizanidina
Baclofeno
Adifenina
Prometazina
Papaverina
Isometepteno
Mepiramina
Hidróxido de alumínio
Hidróxido de magnésio
Bicarbonato de sódio
Ácido cítrico
Beladona
Amoxicilina
Clavulanato
Ampicilina
Oxacilina
Dicloxacilina
Cefalexina
Cefadroxila
Cefuroxima
Ceftriaxona
Cefazolina
Cefotaxima
Ceftazidima
Cefepima
Azitromicina
Claritromicina
Eritromicina
Roxitromicina
Ciprofloxacino
Levofloxacino
Norfloxacino
Moxifloxacino
Ofloxacino
Sulfametoxazol
Trimetoprima
Doxiciclina
Minociclina
Tetraciclina
Metronidazol
Nitazoxanida
Secnidazol
Tinidazol
Fluconazol
Itraconazol
Cetoconazol
Nistatina
Terbinafina
Clotrimazol
Miconazol
Ciclopirox
Aciclovir
Valaciclovir
Oseltamivir
Ivermectina
Albendazol
Mebendazol
Praziquantel
Clindamicina
Vancomicina
Gentamicina
Amicacina
Meropenem
Nitrofurantoína
Fosfomicina
Rifampicina
Isoniazida
Pirazinamida
Etambutol
Benzilpenicilina
Neomicina
Bacitracina
Permetrina
Tobramicina
Losartana
Valsartana
Olmesartana
Candesartana
Telmisartana
Irbesartana
Enalapril
Captopril
Ramipril
Lisinopril
Perindopril
Fosinopril
Benazepril
Anlodipino
Nifedipino
Lercanidipino
Verapamil
Diltiazem
Atenolol
Propranolol
Metoprolol
Carvedilol
Bisoprolol
Nebivolol
Hidroclorotiazida
Furosemida
Espironolactona
Clortalidona
Indapamida
Amilorida
Amiodarona
Digoxina
Varfarina
Femprocumona
Rivaroxabana
Apixabana
Dabigatrana
Edoxabana
Enoxaparina
Clopidogrel
Ticagrelor
Sinvastatina
Atorvastatina
Rosuvastatina
Pravastatina
Pitavastatina
Ezetimiba
Genfibrozila
Fenofibrato
Ciprofibrato
Hidralazina
Metildopa
Clonidina
Metformina
Glibenclamida
Gliclazida
Glimepirida
Repaglinida
Dapagliflozina
Empagliflozina
Canagliflozina
Sitagliptina
Vildagliptina
Linagliptina
Saxagliptina
Alogliptina
Pioglitazona
Acarbose
Liraglutida
Semaglutida
Dulaglutida
Tirzepatida
Exenatida
Insulina glargina
Insulina lispro
Insulina asparte
Insulina detemir
Insulina degludeca
Insulina NPH
Insulina regular
Levotiroxina
Liotironina
Metimazol
Propiltiouracila
Omeprazol
Pantoprazol
Esomeprazol
Lansoprazol
Rabeprazol
Dexlansoprazol
Ranitidina
Famotidina
Domperidona
Bromoprida
Metoclopramida
Ondansetrona
Dimenidrinato
Simeticona
Lactulose
Bisacodil
Macrogol
Loperamida
Racecadotrila
Saccharomyces boulardii
Mesalazina
Sulfassalazina
Sucralfato
Fluoxetina
Sertralina
Escitalopram
Citalopram
Paroxetina
Fluvoxamina
Venlafaxina
Desvenlafaxina
Duloxetina
Bupropiona
Amitriptilina
Nortriptilina
Clomipramina
Imipramina
Mirtazapina
Trazodona
Quetiapina
Risperidona
Olanzapina
Aripiprazol
Haloperidol
Clorpromazina
Levomepromazina
Sulpirida
Amisulprida
Clozapina
Ziprasidona
Carbonato de lítio
Clonazepam
Diazepam
Alprazolam
Bromazepam
Lorazepam
Clobazam
Midazolam
Zolpidem
Zopiclona
Carbamazepina
Oxcarbazepina
Ácido valproico
Divalproato
Lamotrigina
Topiramato
Fenitoína
Fenobarbital
Levetiracetam
Gabapentina
Pregabalina
Lacosamida
Donepezila
Rivastigmina
Memantina
Levodopa
Carbidopa
Benserazida
Pramipexol
Ropinirol
Entacapona
Biperideno
Selegilina
Betaistina
Cinarizina
Flunarizina
Metilfenidato
Lisdexanfetamina
Atomoxetina
Modafinila
Vareniclina
Loratadina
Desloratadina
Cetirizina
Levocetirizina
Fexofenadina
Bilastina
Dexclorfeniramina
Clorfeniramina
Hidroxizina
Difenidramina
Budesonida
Beclometasona
Fluticasona
Mometasona
Salbutamol
Fenoterol
Formoterol
Salmeterol
Ipratrópio
Tiotrópio
Montelucaste
Ambroxol
Acetilcisteína
Bromexina
Carbocisteína
Prednisona
Prednisolona
Dexametasona
Hidrocortisona
Betametasona
Deflazacorte
Fludrocortisona
Fenilefrina
Nafazolina
Oximetazolina
Cloreto de sódio
Sildenafila
Tadalafila
Vardenafila
Udenafila
Finasterida
Dutasterida
Tansulosina
Doxazosina
Ciproterona
Drospirenona
Etinilestradiol
Levonorgestrel
Desogestrel
Gestodeno
Noretisterona
Medroxiprogesterona
Progesterona
Estradiol
Tibolona
Testosterona
Didrogesterona
Alopurinol
Colchicina
Alendronato
Risedronato
Carbonato de cálcio
Colecalciferol
Calcitriol
Ácido fólico
Ácido ascórbico
Sulfato ferroso
Ferripolimaltose
Cianocobalamina
Piridoxina
Tiamina
Isotretinoína
Adapaleno
Tretinoína
Peróxido de benzoíla
Dexpantenol
Clobetasol
Triancinolona
Ácido azelaico
Minoxidil
Timolol
Latanoprosta
Brimonidina
Dorzolamida
Bimatoprosta
Glicosamina
Condroitina
Vitamina C
Vitamina D
Complexo B
Oxibutinina
Tolterodina
Desmopressina
Ácido tranexâmico
Azatioprina
Metotrexato
Hidroxicloroquina
Ciclosporina
Palonosetrona
Granisetrona
Acebrofilina
Teofilina
Aminofilina
Guaifenesina
Azelastina
Ebastina
Rupatadina
Fluocinolona
Griseofulvina
Amorolfina
Linezolida
Piperacilina
Tazobactam
Imipenem
Cilastatina
Polimixina
Sulfadiazina
Oxacilina
Cloxazolam
Eszopiclona
Primidona
Etossuximida
Galantamina
Amantadina
Triexifenidilo
Rasagilina
Paliperidona
Lurasidona
Ivabradina
Sacubitril
Propafenona
Nadolol
Sotalol
Heparina
Prasugrel
Pitavastatina
Nateglinida
Exenatida
Liotironina
Cimetidina
Picossulfato
Docusato
Mesalazina
Fluvoxamina
Dosulepina
Amisulprida
Rivastigmina
Carbidopa
Mirabegrona
Solifenacina
Calcitriol
Raloxifeno
Estriol
Gestodeno
`.trim().split('\n').map(s => s.trim()).filter(Boolean);

const MERCADO_NAMES = `
Arroz
Arroz integral
Arroz parboilizado
Feijão
Feijão preto
Feijão carioca
Feijão fradinho
Grão de bico
Lentilha
Açúcar
Açúcar refinado
Sal
Óleo de soja
Óleo de girassol
Azeite
Vinagre
Farinha de trigo
Farinha de mandioca
Fubá
Polvilho
Tapioca
Macarrão
Leite
Leite integral
Leite desnatado
Leite condensado
Creme de leite
Leite em pó
Leite de coco
Café
Café torrado
Achocolatado
Biscoito
Biscoito recheado
Cream cracker
Pão
Pão de forma
Pão francês
Manteiga
Margarina
Queijo
Queijo mussarela
Queijo prato
Requeijão
Presunto
Iogurte
Frango
Carne moída
Linguiça
Salsicha
Bacon
Ovo
Ovos
Banana
Tomate
Batata
Cebola
Alho
Cenoura
Alface
Cerveja
Refrigerante
Refrigerante cola
Água mineral
Suco
Suco de laranja
Vinho
Detergente
Sabão em pó
Amaciante
Papel higiênico
Creme dental
Shampoo
Condicionador
Absorvente
Fralda
Molho de tomate
Extrato de tomate
Milho verde
Ervilha
Atum
Sardinha
Maionese
Ketchup
Mostarda
Aveia
Granola
Cereal
Chocolate
Sorvete
Pizza
Hambúrguer
Tilápia
Chá
Erva-mate
Azeitona
Palmito
`.trim().split('\n').map(s => s.trim()).filter(Boolean);

const PET_NAMES = `
Ração
Ração Golden
Ração Pedigree
Ração Whiskas
Ração Premier
Ração Royal Canin
Ração Special Dog
Ração Special Cat
Ração úmida
Areia higiênica
Areia para gato
Antipulgas
Vermífugo
Shampoo pet
Coleira
Petisco
Osso
Sachê
Tapete higiênico
Fralda pet
Comedouro
Bebedouro
Brinquedo pet
Condicionador pet
`.trim().split('\n').map(s => s.trim()).filter(Boolean);

// term|Display|ingredient(+ingredient...)|flags|optional generic search
// flags: ref (medicamento de referência), nogen (sem genérico no Brasil)
const BRAND_ROWS = `
novalgina|Novalgina|dipirona|ref
anador|Anador|dipirona|
magnopyrol|Magnopyrol|dipirona|
tylenol|Tylenol|paracetamol|ref
alivium|Alivium|ibuprofeno|ref
advil|Advil|ibuprofeno|
aspirina|Aspirina|acido acetilsalicilico|ref
melhoral|Melhoral|acido acetilsalicilico+cafeina|
doril|Doril|acido acetilsalicilico+cafeina|
cataflam|Cataflam|diclofenaco|ref
voltaren|Voltaren|diclofenaco|
nisulid|Nisulid|nimesulida|ref
profenid|Profenid|cetoprofeno|ref
flanax|Flanax|naproxeno|ref
celebra|Celebra|celecoxibe|ref
arcoxia|Arcoxia|etoricoxibe|ref
tramal|Tramal|tramadol|ref
dorflex|Dorflex|dipirona+orfenadrina+cafeina|
neosaldina|Neosaldina|dipirona+isometepteno+cafeina|
buscopan|Buscopan|escopolamina|ref
buscopan composto|Buscopan Composto|escopolamina+dipirona|
lisador|Lisador|dipirona+prometazina+adifenina|
atroveran|Atroveran|dipirona+papaverina+beladona|
torsilax|Torsilax|carisoprodol+diclofenaco+paracetamol+cafeina|
tylex|Tylex|paracetamol+codeina|ref
sonrisal|Sonrisal|acido acetilsalicilico+bicarbonato de sodio+acido citrico|
engov|Engov|mepiramina+hidroxido de aluminio+acido acetilsalicilico+cafeina|
miosan|Miosan|ciclobenzaprina|ref
cozaar|Cozaar|losartana|ref
aradois|Aradois|losartana|
hyzaar|Hyzaar|losartana+hidroclorotiazida|
diovan|Diovan|valsartana|ref
diovan hct|Diovan HCT|valsartana+hidroclorotiazida|
benicar|Benicar|olmesartana|ref
micardis|Micardis|telmisartana|ref
atacand|Atacand|candesartana|ref
avapro|Avapro|irbesartana|ref
norvasc|Norvasc|anlodipino|ref
pressat|Pressat|anlodipino|
renitec|Renitec|enalapril|ref
capoten|Capoten|captopril|ref
zestril|Zestril|lisinopril|ref
triatec|Triatec|ramipril|ref
coversyl|Coversyl|perindopril|ref
selozok|Selozok|metoprolol|ref
concor|Concor|bisoprolol|ref
coreg|Coreg|carvedilol|ref
atenol|Atenol|atenolol|ref
inderal|Inderal|propranolol|ref
lasix|Lasix|furosemida|ref
aldactone|Aldactone|espironolactona|ref
higroton|Higroton|clortalidona|ref
lipitor|Lipitor|atorvastatina|ref
crestor|Crestor|rosuvastatina|ref
zocor|Zocor|sinvastatina|ref
zetia|Zetia|ezetimiba|ref
vytorin|Vytorin|ezetimiba+sinvastatina|
xarelto|Xarelto|rivaroxabana|ref
eliquis|Eliquis|apixabana|ref
pradaxa|Pradaxa|dabigatrana|ref
marevan|Marevan|varfarina|ref
plavix|Plavix|clopidogrel|ref
cordarone|Cordarone|amiodarona|ref
atlansil|Atlansil|amiodarona|
glifage|Glifage|metformina|ref
glifage xr|Glifage XR|metformina|ref
glucophage|Glucophage|metformina|ref
daonil|Daonil|glibenclamida|ref
diamicron|Diamicron|gliclazida|ref
amaryl|Amaryl|glimepirida|ref
januvia|Januvia|sitagliptina|ref
janumet|Janumet|sitagliptina+metformina|
galvus|Galvus|vildagliptina|ref
galvus met|Galvus Met|vildagliptina+metformina|
trajenta|Trajenta|linagliptina|ref
jardiance|Jardiance|empagliflozina|ref
forxiga|Forxiga|dapagliflozina|ref
ozempic|Ozempic|semaglutida|ref,nogen
wegovy|Wegovy|semaglutida|nogen
rybelsus|Rybelsus|semaglutida|nogen
victoza|Victoza|liraglutida|ref,nogen
saxenda|Saxenda|liraglutida|nogen
trulicity|Trulicity|dulaglutida|ref,nogen
mounjaro|Mounjaro|tirzepatida|ref,nogen
lantus|Lantus|insulina glargina|ref
humalog|Humalog|insulina lispro|ref
novorapid|NovoRapid|insulina asparte|ref
levemir|Levemir|insulina detemir|ref
tresiba|Tresiba|insulina degludeca|ref
losec|Losec|omeprazol|ref
peprazol|Peprazol|omeprazol|
nexium|Nexium|esomeprazol|ref
pantozol|Pantozol|pantoprazol|ref
label|Label|lansoprazol|ref
motilium|Motilium|domperidona|ref
plasil|Plasil|metoclopramida|ref
digesan|Digesan|bromoprida|ref
vonau|Vonau|ondansetrona|ref
dramin|Dramin|dimenidrinato|ref
luftal|Luftal|simeticona|ref
imosec|Imosec|loperamida|ref
floratil|Floratil|saccharomyces boulardii|ref
lactulona|Lactulona|lactulose|ref
dulcolax|Dulcolax|bisacodil|ref
prozac|Prozac|fluoxetina|ref
daforin|Daforin|fluoxetina|
zoloft|Zoloft|sertralina|ref
lexapro|Lexapro|escitalopram|ref
cipramil|Cipramil|citalopram|ref
aropax|Aropax|paroxetina|ref
pondera|Pondera|paroxetina|
efexor|Efexor|venlafaxina|ref
pristiq|Pristiq|desvenlafaxina|ref
cymbalta|Cymbalta|duloxetina|ref
velija|Velija|duloxetina|
wellbutrin|Wellbutrin|bupropiona|ref
zyban|Zyban|bupropiona|
tryptanol|Tryptanol|amitriptilina|ref
pamelor|Pamelor|nortriptilina|ref
anafranil|Anafranil|clomipramina|ref
remeron|Remeron|mirtazapina|ref
donaren|Donaren|trazodona|ref
seroquel|Seroquel|quetiapina|ref
risperdal|Risperdal|risperidona|ref
zyprexa|Zyprexa|olanzapina|ref
abilify|Abilify|aripiprazol|ref
aristab|Aristab|aripiprazol|
haldol|Haldol|haloperidol|ref
amplictil|Amplictil|clorpromazina|ref
neozine|Neozine|levomepromazina|ref
carbolitium|Carbolitium|carbonato de litio|ref
rivotril|Rivotril|clonazepam|ref
frontal|Frontal|alprazolam|ref
valium|Valium|diazepam|ref
lexotan|Lexotan|bromazepam|ref
lorax|Lorax|lorazepam|ref
dormonid|Dormonid|midazolam|ref
stilnox|Stilnox|zolpidem|ref
tegretol|Tegretol|carbamazepina|ref
trileptal|Trileptal|oxcarbazepina|ref
depakene|Depakene|acido valproico|ref
depakote|Depakote|divalproato|ref
lamictal|Lamictal|lamotrigina|ref
topamax|Topamax|topiramato|ref
gardenal|Gardenal|fenobarbital|ref
hidantal|Hidantal|fenitoina|ref
keppra|Keppra|levetiracetam|ref
neurontin|Neurontin|gabapentina|ref
lyrica|Lyrica|pregabalina|ref
prolopa|Prolopa|levodopa+benserazida|
sifrol|Sifrol|pramipexol|ref
ebix|Ebix|memantina|ref
eranz|Eranz|donepezila|ref
donila|Donila|donepezila|
akineton|Akineton|biperideno|ref
dogmatil|Dogmatil|sulpirida|ref
equilid|Equilid|sulpirida|
serc|Serc|betaistina|ref
labirin|Labirin|betaistina|
stugeron|Stugeron|cinarizina|ref
vertix|Vertix|flunarizina|ref
flunarin|Flunarin|flunarizina|
viagra|Viagra|sildenafila|ref
cialis|Cialis|tadalafila|ref
levitra|Levitra|vardenafila|ref
pramil|Pramil|sildenafila|
propecia|Propecia|finasterida|
proscar|Proscar|finasterida|ref
avodart|Avodart|dutasterida|ref
omnic|Omnic|tansulosina|ref
androcur|Androcur|ciproterona|ref
yasmin|Yasmin|drospirenona+etinilestradiol|ref
microvlar|Microvlar|levonorgestrel+etinilestradiol|ref
cerazette|Cerazette|desogestrel|ref
utrogestan|Utrogestan|progesterona|ref
livial|Livial|tibolona|ref
depo provera|Depo-Provera|medroxiprogesterona|ref
zyloric|Zyloric|alopurinol|ref
colchis|Colchis|colchicina|ref
fosamax|Fosamax|alendronato|ref
roacutan|Roacutan|isotretinoina|ref
differin|Differin|adapaleno|ref
canesten|Canesten|clotrimazol|ref
lamisil|Lamisil|terbinafina|ref
sporanox|Sporanox|itraconazol|ref
zoltec|Zoltec|fluconazol|ref
bepantol|Bepantol|dexpantenol|ref
nebacetin|Nebacetin|neomicina+bacitracina|
noripurum|Noripurum|ferripolimaltose|ref
cewin|Cewin|acido ascorbico|ref|vitamina c
redoxon|Redoxon|acido ascorbico|ref|vitamina c
addera d3|Addera D3|colecalciferol|ref|vitamina d
oscal|Oscal|carbonato de calcio|ref
condroflex|Condroflex|glicosamina+condroitina|
neosoro|Neosoro|nafazolina|ref
sorine|Sorine|cloreto de sodio|ref
afrin|Afrin|oximetazolina|ref
naridrin|Naridrin|cloreto de sodio|
allegra|Allegra|fexofenadina|ref
claritin|Claritin|loratadina|ref
histadin|Histadin|loratadina|
zyrtec|Zyrtec|cetirizina|ref
zyxem|Zyxem|levocetirizina|ref
polaramine|Polaramine|dexclorfeniramina|ref
fenergan|Fenergan|prometazina|ref
singular|Singular|montelucaste|ref
montelair|Montelair|montelucaste|
aerolin|Aerolin|salbutamol|ref
berotec|Berotec|fenoterol|ref
atrovent|Atrovent|ipratropio|ref
clenil|Clenil|beclometasona|ref
busonid|Busonid|budesonida|
pulmicort|Pulmicort|budesonida|ref
symbicort|Symbicort|budesonida+formoterol|ref
alenia|Alenia|budesonida+formoterol|
seretide|Seretide|fluticasona+salmeterol|ref
fluimucil|Fluimucil|acetilcisteina|ref
mucosolvan|Mucosolvan|ambroxol|ref
bisolvon|Bisolvon|bromexina|ref
predsim|Predsim|prednisona|ref
decadron|Decadron|dexametasona|ref
celestone|Celestone|betametasona|ref
amoxil|Amoxil|amoxicilina|ref
clavulin|Clavulin|amoxicilina+clavulanato|ref
keflex|Keflex|cefalexina|ref
zinnat|Zinnat|cefuroxima|ref
rocefin|Rocefin|ceftriaxona|ref
zitromax|Zitromax|azitromicina|ref
astro|Astro|azitromicina|
klaricid|Klaricid|claritromicina|ref
cipro|Cipro|ciprofloxacino|ref
tavanic|Tavanic|levofloxacino|ref
bactrim|Bactrim|sulfametoxazol+trimetoprima|ref
infectrin|Infectrin|sulfametoxazol+trimetoprima|
flagyl|Flagyl|metronidazol|ref
annita|Annita|nitazoxanida|ref
zentel|Zentel|albendazol|ref
pantelmin|Pantelmin|mebendazol|ref
revectina|Revectina|ivermectina|ref
ivexterm|Ivexterm|ivermectina|
zovirax|Zovirax|aciclovir|ref
valtrex|Valtrex|valaciclovir|ref
tamiflu|Tamiflu|oseltamivir|ref
ritalina|Ritalina|metilfenidato|ref
concerta|Concerta|metilfenidato|
venvanse|Venvanse|lisdexanfetamina|ref,nogen
strattera|Strattera|atomoxetina|ref
puran t4|Puran T4|levotiroxina|ref
puran|Puran|levotiroxina|
euthyrox|Euthyrox|levotiroxina|ref
synthroid|Synthroid|levotiroxina|ref
tapazol|Tapazol|metimazol|ref
`.trim().split('\n').map(s => s.trim()).filter(Boolean);

function uniqueNames(names, label) {
  const seen = new Set();
  const out = [];
  for (const display of names) {
    const term = normalize(display);
    if (seen.has(term)) continue;
    seen.add(term);
    out.push({ term, display, type: label === 'brand' ? 'brand' : 'product' });
  }
  return out;
}

const INGREDIENTS = uniqueNames(INGREDIENT_NAMES, 'ingredient').map(x => ({ ...x, type: 'ingredient', segment: 'farmacia' }));
const ING_BY_TERM = new Map(INGREDIENTS.map(i => [i.term, i]));

function parseBrand(row) {
  const [termRaw, display, ings, flags = '', genericQuery] = row.split('|');
  const ingredients = ings.split('+').map(s => normalize(s));
  const flagSet = new Set(flags.split(',').map(s => s.trim()).filter(Boolean));
  const combination = ingredients.length > 1;
  const hasGeneric = !flagSet.has('nogen');
  for (const ing of ingredients) {
    if (!ING_BY_TERM.has(ing)) throw new Error(`Ingrediente desconhecido "${ing}" em ${termRaw}`);
  }
  const labels = ingredients.map(ing => ING_BY_TERM.get(ing).display);
  const note = combination
    ? `Associação (${labels.join(' + ')}). Genéricos e similares referem-se a essa associação, não a um componente isolado.`
    : null;
  return {
    term: normalize(termRaw),
    display: display.trim(),
    type: 'brand',
    segment: 'farmacia',
    ingredients,
    ingredientLabels: labels,
    combination,
    hasGeneric,
    genericQuery: hasGeneric ? normalize(genericQuery || ingredients.join(' ')) : null,
    reference: flagSet.has('ref'),
    note,
  };
}

const BRANDS = BRAND_ROWS.map(parseBrand);
const brandTerms = new Set();
for (const b of BRANDS) {
  if (brandTerms.has(b.term)) throw new Error('Marca duplicada: ' + b.term);
  brandTerms.add(b.term);
}
const BRAND_BY_TERM = new Map(BRANDS.map(b => [b.term, b]));

const MERCADO = uniqueNames(MERCADO_NAMES, 'product').map(x => ({ ...x, segment: 'mercado' }));
const PET = uniqueNames(PET_NAMES, 'product').map(x => ({ ...x, segment: 'petshop' }));

function termsFor(segment) {
  if (segment === 'mercado') return MERCADO;
  if (segment === 'petshop') return PET;
  const seen = new Set();
  const out = [];
  for (const item of [...INGREDIENTS, ...BRANDS]) {
    if (seen.has(item.term)) continue;
    seen.add(item.term);
    out.push({ term: item.term, display: item.display, segment: 'farmacia', type: item.type });
  }
  return out;
}

function publicBrand(brand) {
  return {
    term: brand.term,
    display: brand.display,
    ingredients: brand.ingredients,
    ingredientDisplay: brand.ingredientLabels.join(' + '),
    hasGeneric: brand.hasGeneric,
    combination: brand.combination,
    note: brand.note,
    genericQuery: brand.genericQuery,
  };
}

function stripDose(q) {
  return normalize(q)
    .replace(/\b\d+(?:[.,]\d+)?\s*(mg\/ml|mcg|ui|mg|kg|ml|g|l|comp|caps)?\b/g, ' ')
    .replace(/\b(comprimidos?|capsulas?|drageas?|gotas|xarope|comprimido)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyQuery(raw, segment) {
  if (segment !== 'farmacia') return { brand: null, ingredient: null };
  const n = stripDose(raw);
  if (!n) return { brand: null, ingredient: null };
  const brands = [...BRANDS].sort((a, b) => b.term.length - a.term.length);
  const brand = brands.find(b => n === b.term || n.startsWith(b.term + ' '));
  if (brand) return { brand: publicBrand(brand), ingredient: null };
  const ings = [...INGREDIENTS].sort((a, b) => b.term.length - a.term.length);
  const ing = ings.find(i => n === i.term || n.startsWith(i.term + ' '));
  if (!ing) return { brand: null, ingredient: null };
  const refs = BRANDS
    .filter(b => b.reference && !b.combination && b.ingredients.length === 1 && b.ingredients[0] === ing.term)
    .map(b => b.display);
  return { brand: null, ingredient: { term: ing.term, display: ing.display, referenceBrands: [...new Set(refs)].slice(0, 5) } };
}

function lookupBrand(term) {
  return BRAND_BY_TERM.get(normalize(term)) || null;
}

function stats() {
  return {
    ingredients: INGREDIENTS.length,
    brands: BRANDS.length,
    mercado: MERCADO.length,
    pet: PET.length,
    farmaciaTerms: termsFor('farmacia').length,
  };
}

module.exports = {
  INGREDIENTS,
  BRANDS,
  MERCADO,
  PET,
  termsFor,
  classifyQuery,
  lookupBrand,
  stats,
};
