# Texto para abrir chamado na Central de Serviços do Vista (novovista.com.br)

**Assunto:** Solicitação de chave de API REST para integração própria

**Corpo da mensagem:**

Olá, equipe Vista Software.

Sou cliente Vista/Loft CRM (LOBO IMOVEIS, usuário Hugo Vilhena) e gostaria de
solicitar uma chave de API REST (documentação em vistasoft.com.br/api) para
uma integração própria que estamos desenvolvendo — um painel interno de
gestão, qualidade de anúncios e acompanhamento de leads que consome dados do
nosso próprio inventário de imóveis e da nossa própria base de clientes.

Preciso de acesso de leitura completo, cobrindo:

- Endpoints de imóveis (`imoveis/listar`, `imoveis/detalhes`, `imoveis/historico`),
  com todos os campos disponíveis do imóvel, incluindo (mas não limitado a)
  Codigo, DataCadastro, DataAtualizacao, Bairro, Cidade, ValorVenda,
  ValorLocacao, Corretor e Agencia.
- Endpoints de clientes/leads (`clientes/listar`, `clientes/detalhes`,
  `clientes/historico`), com todos os campos disponíveis do cliente/lead,
  incluindo origem do lead, corretor responsável, histórico de contatos e
  status/etapa do funil.

Se houver algum endpoint adicional de negócios/propostas ou métricas que
recomendem para esse tipo de integração, agradeço se puderem incluir também.

Poderiam me enviar a URL de integração específica da minha conta (formato
`http://<minha-url>.vistahost.com.br/`) e a chave de API correspondente, já
com essas permissões habilitadas?

Obrigado.

---

## Depois de receber a chave

Me avise com:
1. A URL de integração (ex: `http://loboimov.vistahost.com.br/`)
2. A chave de API

Não me envie isso em texto simples de forma exposta se puder evitar — pode
colar direto aqui na conversa, eu trato como dado sensível (mesmo cuidado que
já tomamos com os links de XML). Com isso eu adapto o script de sincronização
para usar a API em vez do XML, e resolvemos o campo de data de cadastro
(e qualquer outro campo que o XML não trouxer).
