# Busca Preços

Protótipo de comparador de preços para **farmácia, mercado e petshop**. Você digita um produto (ex.: "losartana", "dipirona", "arroz", "ração golden"), escolhe a apresentação (dose/tamanho) e o app mostra as ofertas do mais barato para o mais caro, com link, endereço da loja física mais próxima e distância em linha reta.

## Onde você está
A busca vale para o Brasil inteiro. O navegador usa o GPS quando pode; também dá para informar um CEP ou uma cidade (ex.: `85884-000` ou `Medianeira PR`). Sem nada disso, o ponto de partida continua sendo o Recreio, no Rio.

As ofertas **perto de você** são só de redes com loja num raio de 30 km (distância em linha reta). O que não tem filial nesse raio vai para a seção **Só online ou sem loja nesse raio**. O preço é o do site da rede (em geral o e-commerce nacional, não a gôndola daquela loja): o balcão pode ser diferente, e a maioria dos sites não publica preço por CEP.

## Fontes com preço
- **Farmácia:** Droga Raia e Drogasil (busca pública do catálogo), Pague Menos, Extrafarma, Drogaria São Paulo, Pacheco, Venancio, São João, Indiana, Drogal, Catarinense, Araujo (catálogo VTEX) + Buscapé na seção online
- **Mercado:** Carrefour, Atacadão, Super Muffato, Angeloni, Zaffari, Prezunic, Zona Sul, GBarbosa, Hortifruti, Mambo, Savegnago, Super Nosso, Hiperideal, Bretas, Giassi, Coop, Formosa + Buscapé
- **Petshop:** Cobasi + Buscapé
- **Lojas:** OpenStreetMap / Nominatim (máx. 1 req/s, cache de 24 h)

Fontes que o site bloqueia daqui e ficam de fora do preço: Farmácias Nissei, Panvel, Petz, Petlove, Pão de Açúcar, Assaí e Extra. Sem resposta, a fonte aparece como ✖. Nada é inventado.

## Hotéis e passagens
As abas **Hotéis** e **Passagens** pedem adultos, crianças (com a idade de cada uma, de 0 a 17) e, no hotel, a distribuição por quarto. Dá para filtrar datas flexíveis, cabine, escalas, bagagem, horário, estrelas, café da manhã, cancelamento, comodidades e ordenação.

O servidor tenta ler preço de verdade em cada fonte. Se o site bloqueia o datacenter, devolve timeout ou só monta a página no navegador, **não aparece valor**. No lugar, a tela abre a busca já preenchida (Google, Kayak, Decolar, Booking, Hoteis.com, Expedia, Trivago, Hurb, Skyscanner, MaxMilhas, 123milhas, ViajaNet, Submarino Viagens, LATAM, GOL e Azul).

A API self-service da Amadeus foi desligada em 17 de julho de 2026. O preço automático usa quem ainda deixa um desenvolvedor criar chave sozinho, sem credenciamento:

1. **SerpApi** (voos e hotéis, uma chave). São os preços do Google Voos e do Google Hotéis, em real.
   1. Crie a conta em https://serpapi.com/users/sign_up (sem cartão).
   2. Copie a chave em https://serpapi.com/manage-api-key.
   3. No Render, crie a variável `SERPAPI_KEY` com esse valor.
   Plano grátis: 250 buscas bem-sucedidas por mês e até 50 por hora. Busca em cache (1 h, mesmos parâmetros) não consome cota.
2. **LiteAPI** (só hotéis, opcional, diária de estoque real, não o preço de vitrine do Google).
   1. Crie a conta em https://dashboard.liteapi.travel/register (sem cartão na sandbox).
   2. Copie a chave sandbox (`sand_...`) ou a de produção.
   3. No Render, crie `LITEAPI_KEY`.
   A busca de tarifas, a pré-reserva e a reserva não têm taxa enquanto a proporção de buscas por reserva se mantém razoável. A sandbox não pede cartão.

Sem `SERPAPI_KEY` e sem `LITEAPI_KEY` a comparação automática fica vazia e só os links aparecem. No Google Voos, bebê (0 ou 1 ano) vai no colo, de 2 a 11 anos conta como criança e de 12 a 17 entra nos adultos. No Google Hotéis cada idade segue na busca (menos de 1 ano vira 1, o mínimo que o Google aceita). Na LiteAPI cada quarto recebe os adultos e as idades exatamente como no formulário.

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
- Geolocalização do navegador exige HTTPS (o Render já fornece). Dá para trocar o ponto por CEP ou cidade. Sem permissão e sem CEP, usa o Recreio (RJ).
- `npm run screens` gera capturas de tela com Playwright (opcional).
