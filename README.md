# CurrencyConverterWidget

Widget compacto e responsivo de conversão de moedas, desenvolvido com **React + TypeScript** para uso em portais de agências de viagens ou outros projetos React. Inclui uma demo independente e um build de biblioteca reutilizável.

## Funcionalidades

- Conversão simultânea entre várias moedas, com todos os valores editáveis.
- EUR e USD sempre presentes e protegidos contra exclusão.
- Adição e remoção de outras moedas pelo seletor.
- Reordenação por arraste com mouse/toque ou pelas setas ↑/↓ no controle de cada linha, inclusive EUR e USD.
- Máscara monetária e nomes de moedas em português ou inglês.
- Conversões intermediadas por USD, com carregamento e erros por moeda.
- Cache de taxas, deduplicação de requisições e proteção contra respostas obsoletas.
- Persistência das moedas, da ordem e do valor em USD no localStorage.
- Rodapé mínimo: botão **i** para informações e **♡ LOVEThenDO**.

## Requisitos e instalação

- Node.js **22.12 ou superior em uma versão compatível com as dependências**. A versão recomendada é Node 22, indicada em `.nvmrc` e usada no CI.
- npm.
- Conexão com a internet para consultar novas taxas e o catálogo da Frankfurter.

Na pasta do projeto:

```sh
# Se utilizar nvm:
nvm use

npm ci
npm run dev
```

Abra o endereço indicado pelo Vite, normalmente `http://127.0.0.1:5173/`. A demo usa o mesmo widget, com persistência ativada e a chave `ccw:demo:v1`.

Para conferir os idiomas, abra `http://127.0.0.1:5173/?lang=pt` ou `http://127.0.0.1:5173/?lang=en`.

## Comandos

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Inicia a demo local |
| `npm test` | Executa os testes uma vez |
| `npm run test:watch` | Executa testes em modo contínuo |
| `npm run build` | Verifica TypeScript e gera a demo em `dist/` |
| `npm run build:widget` | Gera a biblioteca ES e CSS em `dist-widget/` |
| `npm run check` | Executa testes, verificação de tipos e os dois builds |

## Integrar em um projeto React

A biblioteca utiliza React e React DOM do projeto hospedeiro, com suporte declarado para versões 18 ou superiores. A demo e os testes usam React 19.

Primeiro, gere a biblioteca na pasta do CurrencyConverterWidget:

```sh
npm ci
npm run build:widget
npm pack
```

No projeto React que utilizará o widget, instale o arquivo gerado, ajustando o caminho:

```sh
npm install /caminho/CCW/currency-converter-widget-0.1.0.tgz
```

Depois importe o componente **e seu CSS**:

```tsx
import { CurrencyConverterWidget } from 'currency-converter-widget';
import 'currency-converter-widget/style.css';

export function CurrencyTool() {
  return (
    <CurrencyConverterWidget
      lang="pt-BR"
      initialCurrencies={['BRL', 'GBP', 'JPY']}
      initialAmount={100}
      persist={true}
      storageKey="portal:currency-widget"
    />
  );
}
```

O pacote não foi publicado no registro npm. A instalação por arquivo local permite utilizá-lo sem essa publicação. Os tipos são exportados a partir das fontes TypeScript; o build atual não gera arquivos `.d.ts` separados. A demo carrega fontes do Google Fonts; a biblioteca não importa essas fontes e usa as fontes disponíveis na página, com fallback para sans-serif.

### Parâmetros do componente

| Propriedade | Tipo | Padrão | Uso |
| --- | --- | --- | --- |
| `lang` | `string` | Detecção automática | Escolhe EN/PT, inclusive variantes regionais |
| `initialCurrencies` | `string[]` | `['BRL', 'GBP', 'JPY']` | Moedas adicionais, com códigos de três letras em maiúsculas |
| `initialAmount` | `number` | `100` | Valor inicial em USD, finito e não negativo |
| `persist` | `boolean` | `true` | Ativa a restauração e gravação no localStorage |
| `storageKey` | `string` | `'ccw:v1'` | Chave de armazenamento e identificador dos controles |
| `client` | `ExchangeClient` | Cliente Frankfurter compartilhado | Permite injetar um cliente para integração ou testes |

Use uma `storageKey` distinta para cada instância na mesma página. Dados persistidos válidos prevalecem sobre os valores iniciais. As propriedades iniciais são lidas na montagem; alterá-las depois não reinicializa o widget. `lang` pode mudar após a montagem sem perder os valores.

Também são exportados `createFrankfurterClient`, `resolveLanguage` e os tipos `CurrencyConverterWidgetProps`, `ExchangeClient`, `Currency`, `Rate` e `Language`.

## Internacionalização: EN e PT

A seleção segue esta ordem, ignorando valores vazios:

1. Propriedade do componente, por exemplo `lang="pt-PT"`.
2. Parâmetro `lang` da URL da página, por exemplo `?lang=en`.
3. Idioma declarado no elemento `<html lang="…">` da página hospedeira.
4. Idioma preferido do navegador: `navigator.languages[0]` ou `navigator.language`.
5. Sem informação disponível: **EN**.

O primeiro valor informado determina o idioma. `pt`, `pt-BR`, `pt-PT` e outras variantes de português usam PT; qualquer outro idioma usa EN. A comparação ignora maiúsculas/minúsculas. A detecção ocorre no navegador, sem consultar um servidor ou ler cabeçalhos HTTP. Sem navegador e sem `lang` explícito, o componente usa EN.

Textos, rótulos acessíveis, nomes de moedas, valores e datas acompanham o idioma. A formatação usa `pt-BR` para PT e `en-US` para EN. Nomes são obtidos por `Intl.DisplayNames`; códigos não reconhecidos pelo navegador podem aparecer sem tradução. Mudanças na URL ou no idioma da página são consideradas na próxima renderização; o widget não registra um listener específico para mudanças de URL.

## Valores e conversões

Na primeira utilização, EUR e USD aparecem antes das moedas adicionais. A ordem pode ser alterada e persistida; essas duas moedas não podem ser removidas. O seletor permite até 30 linhas no fluxo normal de adição.

A máscara interpreta os dígitos como unidades mínimas da moeda:

- USD em PT: `12345` → `123,45`.
- USD em EN: `12345` → `123.45`.
- JPY, que não utiliza casas decimais: `12345` → `12.345` em PT ou `12,345` em EN.

Valores negativos não são suportados. O campo aceita até 14 dígitos e seleciona o conteúdo ao receber foco, facilitando sua substituição. Casas decimais seguem `Intl.NumberFormat`.

Após uma edição, o widget invalida imediatamente respostas anteriores e aguarda 200 ms antes de converter:

1. Se a origem não for USD, obtém a taxa origem→USD.
2. Com o valor em USD, inicia as consultas USD→destinos em paralelo.
3. Atualiza cada linha individualmente, preservando o valor editado.

Uma falha em um destino não bloqueia os outros. Ao remover a moeda que estava sendo editada, USD passa a ser a referência usando o último valor disponível. Reordenar moedas não altera valores nem inicia novas conversões.

Os cálculos usam números JavaScript; o arredondamento ocorre na exibição. O widget serve para consultas indicativas, não para liquidação financeira.

## Persistência e recarregamento

A persistência está ativada por padrão. Para desativá-la, passe `persist={false}`.

O localStorage guarda:

```json
{
  "version": 2,
  "codes": ["BRL", "EUR", "USD"],
  "usdAmount": 100
}
```

- `codes` preserva as moedas e sua ordem, incluindo adições e remoções.
- `usdAmount` guarda o último valor válido em USD.
- Edições em USD são salvas sem esperar as conversões dos destinos.
- Edições em outra moeda atualizam o USD salvo assim que a conversão intermediária termina com sucesso. Se falhar, o último USD válido é mantido.
- Ao recarregar, USD é restaurado como referência e as outras moedas são reconvertidas. As taxas não são persistidas.
- O formato anterior, que armazenava a moeda de origem, é migrado após uma conversão bem-sucedida.

Dados inválidos são ignorados. Se o navegador bloquear o armazenamento, o widget continua funcionando durante a sessão. A preferência fica no navegador e na origem da página; não é sincronizada entre dispositivos. Para reiniciar a configuração, remova a entrada correspondente à `storageKey` no armazenamento local do navegador.

## Frankfurter v2 e cache

Endpoint fixo: `https://api.frankfurter.dev/v2`.

| Rota | Dados usados |
| --- | --- |
| `GET /currencies` | Catálogo com `iso_code` e `name` |
| `GET /rate/{base}/{quote}` | `base`, `quote`, `rate` e `date` |

A [Frankfurter](https://frankfurter.dev) é gratuita, dispensa chave e oferece taxas de referência diárias. A API pública aplica controle contra abuso. Não há backend próprio nem segredo de API no widget.

O cliente armazena respostas em memória por uma hora e deduplica requisições simultâneas. `createFrankfurterClient(ttl)` permite configurar a duração em milissegundos. Cada requisição tem timeout de 12 segundos. A atualização manual limpa o cache e consulta novamente o catálogo e as taxas.

No rodapé, o botão **i** abre as informações da API, o estado de carregamento, as datas disponíveis, o aviso sobre valores e a ação de atualizar taxas. O painel fecha pelo botão, por clique externo ou por Escape.

As taxas não são cotações em tempo real e não incluem IOF, tarifas ou spread. Datas podem variar entre pares. Sem internet, respostas ainda válidas no cache podem funcionar; novos pares podem falhar. Não existe fallback silencioso para taxas fictícias.

## Estrutura

```text
src/
  CurrencyConverterWidget.tsx  Componente e estado de conversão
  api.ts                      Cliente Frankfurter, cache e validação
  i18n.ts                     Idiomas, detecção e nomes de moedas
  money.ts                    Máscara e formatação monetária
  index.ts                    Exportações da biblioteca
  main.tsx                    Demo
  style.css                   Estilos do widget
  demo.css                    Estilos exclusivos da demo
  *.test.tsx                  Testes funcionais e de idiomas
vite.config.ts                Demo e testes
vite.lib.config.ts            Build da biblioteca
.github/workflows/ci.yml       Validação no GitHub Actions
```

## Validação

```sh
npm run check
```

Vitest e Testing Library verificam conversões via USD, moedas protegidas, máscara, seleção/adição/remoção, cache, deduplicação, erros individuais, proteção contra respostas obsoletas, EN/PT, persistência de USD e restauração da ordem. Os testes usam respostas simuladas e não dependem da API pública.

O CI executa `npm ci` e `npm run check` com Node 22 em pushes e pull requests. O workflow valida o projeto; não publica automaticamente a demo ou um pacote npm.

## Enviar para o GitHub

Antes de enviar:

```sh
npm run check
git init
git add .
git commit -m "Initial CurrencyConverterWidget"
git branch -M main
```

Crie um repositório vazio chamado **CurrencyConverterWidget** na sua conta. Depois execute, substituindo `SEU_USUARIO`:

```sh
git remote add origin https://github.com/SEU_USUARIO/CurrencyConverterWidget.git
git push -u origin main
```

Se já existir um repositório ou remoto, use a configuração existente. O `.gitignore` exclui dependências, builds e arquivos locais; o `package-lock.json` deve ser enviado. Se tiver gerado um `.tgz` com `npm pack`, não o inclua no commit.

### Publicar a demo

`npm run build` gera um site estático em `dist/`. A configuração usa caminhos relativos (`base: './'`), permitindo hospedagem em uma subpasta, como no GitHub Pages. Publique o conteúdo de `dist/` pela configuração de hospedagem escolhida. O projeto ainda não inclui um workflow de deploy.

### Licença

Ainda não foi definida uma licença. Antes de disponibilizar o projeto para reutilização pública, escolha a licença e adicione o arquivo `LICENSE` correspondente. Nenhuma licença, conta GitHub ou endereço de repositório foi presumido.
