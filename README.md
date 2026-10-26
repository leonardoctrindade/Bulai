# Busca Preços

Protótipo de comparador de preços para **farmácia, mercado e petshop**. Você digita um produto (ex.: "losartana", "dipirona", "arroz", "ração golden"), escolhe a apresentação (dose/tamanho) e o app mostra as ofertas do mais barato para o mais caro, com link, endereço da loja física mais próxima e distância em linha reta.

## Fontes
- **Farmácia:** Drogarias Pacheco, Drogaria Venancio, Pague Menos, Drogaria São Paulo (APIs públicas de catálogo VTEX) + Buscapé
- **Mercado:** Prezunic, Zona Sul, Atacadão + Buscapé
- **Petshop:** Cobasi + Buscapé
- **Lojas próximas:** OpenStreetMap / Nominatim (máx. 1 req/s, cache de 24 h)

Preços são os do site de cada rede (compra online); o preço no balcão pode variar. Nada é inventado: sem resposta da fonte, ela aparece como ✖ na tela.

## Digitação e genéricos
Um termo com erro (ex.: "diprona", "monajuro", "losartan") é comparado a um dicionário local de princípios ativos, marcas vendidas no Brasil e itens de mercado/petshop. A comparação usa distância de Damerau-Levenshtein, semelhança de trigramas e uma chave fonética simples de pt-BR (sem acento, h mudo, s/z/x/c). Se o palpite é seguro, a busca já usa o nome certo e a tela avisa "Mostrando resultados para …". Se houver mais de um candidato próximo, aparecem atalhos "Você quis dizer".

Quando a busca é uma marca (Cozaar, Tylenol, Glifage, Puran T4, Losec…), o app também procura o princípio ativo e mostra a seção **Genéricos e similares**, com a economia em relação à oferta mais barata da marca. Associações como Dorflex não são tratadas como a dipirona isolada. Se não há genérico no Brasil (Mounjaro/tirzepatida, Ozempic/semaglutida e outros análogos de GLP-1), a tela diz "Sem genérico disponível". O dicionário é uma lista de nomes comuns, não o catálogo oficial da CMED.

## Rodar localmente
```bash
npm install
npm test    # corretor de digitação e mapa marca → princípio ativo
npm start   # http://localhost:3000 (ou defina PORT)
```

## Deploy no Render
1. No Render: **New → Blueprint** e selecione este repositório (usa o `render.yaml`), ou **New → Web Service** com build `npm install` e start `npm start`.
2. Plano free: o serviço "dorme" após inatividade e demora ~1 min no primeiro acesso.

## Observações
- Limite de 30 buscas por minuto por IP.
- Geolocalização do navegador exige HTTPS (o Render já fornece). Sem permissão, usa o Recreio (RJ) como padrão.
- `npm run screens` gera capturas de tela com Playwright (opcional).
