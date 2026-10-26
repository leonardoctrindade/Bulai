# Busca Preços

Protótipo de comparador de preços para **farmácia, mercado e petshop**. Você digita um produto (ex.: "losartana", "dipirona", "arroz", "ração golden"), escolhe a apresentação (dose/tamanho) e o app mostra as ofertas do mais barato para o mais caro, com link, endereço da loja física mais próxima e distância em linha reta.

## Fontes
- **Farmácia:** Drogarias Pacheco, Drogaria Venancio, Pague Menos, Drogaria São Paulo (APIs públicas de catálogo VTEX) + Buscapé
- **Mercado:** Prezunic, Zona Sul, Atacadão + Buscapé
- **Petshop:** Cobasi + Buscapé
- **Lojas próximas:** OpenStreetMap / Nominatim (máx. 1 req/s, cache de 24 h)

Preços são os do site de cada rede (compra online); o preço no balcão pode variar. Nada é inventado: sem resposta da fonte, ela aparece como ✖ na tela.

## Rodar localmente
```bash
npm install
npm start   # http://localhost:3000 (ou defina PORT)
```

## Deploy no Render
1. No Render: **New → Blueprint** e selecione este repositório (usa o `render.yaml`), ou **New → Web Service** com build `npm install` e start `npm start`.
2. Plano free: o serviço "dorme" após inatividade e demora ~1 min no primeiro acesso.

## Observações
- Limite de 30 buscas por minuto por IP.
- Geolocalização do navegador exige HTTPS (o Render já fornece). Sem permissão, usa o Recreio (RJ) como padrão.
- `npm run screens` gera capturas de tela com Playwright (opcional).
