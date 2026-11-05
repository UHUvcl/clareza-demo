# Validação da demonstração

Base: commit `1231d99` da branch `fix/exclusao-recebimentos-parciais`, lido sem alteração do projeto original. A cópia usa somente fontes selecionadas e cenários fictícios; o histórico Git e os arquivos operacionais não foram copiados.

## Evidências reproduzíveis

- `npm test`: 50 testes de domínio e estado local.
- `npm run typecheck`: verificação estrita de TypeScript.
- `npm run build`: gera somente HTML, CSS, JavaScript, ícone e cabeçalhos estáticos.
- `npm run check:isolation`: procura canais de rede, armazenamento persistente, arquivos operacionais e referências ao serviço original; confirma a CSP do build.
- `npm run test:browser`: seis testes contra o build, com Chromium, em desktop e 390 × 844, incluindo subdiretório de hospedagem.

Os testes de navegador observam as requisições, bloqueiam e falham em qualquer tentativa externa, verificam ausência de chamadas à API, exercitam exportação/importação fictícia e conferem ausência de cookies e armazenamento persistente. Verificam também que os canais de comunicação do navegador foram bloqueados.

## Limites

Não foi realizado deploy nem teste de um endereço público definitivo. Cabeçalhos específicos da hospedagem devem ser conferidos quando ela for escolhida. O aviso de bundle maior que 500 kB permanece; não é erro de build. A suíte não substitui uma auditoria completa de acessibilidade nem testa todas as combinações possíveis de formulários.

O repositório contém somente esta demonstração. Não há remoto configurado nesta entrega.
