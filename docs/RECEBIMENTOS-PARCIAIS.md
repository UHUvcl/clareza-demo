# Recebimentos parciais nesta demonstração

As regras foram preservadas do commit `1231d99` do Clareza. Esta edição não inclui a API nem o banco do aplicativo original: os registros são exclusivamente fictícios e mantidos no estado React.

## Datas

`Entry.expectedDate` guarda a data originalmente prevista. `Entry.date` representa a previsão enquanto pendente e a data efetiva quando recebido. O primeiro recebimento e o salvamento de uma pendência preservam a previsão para que a quitação não a substitua pela data do pagamento.

O campo opcional mantém compatibilidade com estruturas anteriores e acompanha o JSON exportado. Se uma receita antiga já quitada não tiver a data original, a reversão é recusada. Somente uma data conhecida pode ser informada; não se infere a previsão a partir da data do pagamento.

## Exclusão

`planIncomeDeletion` retorna as substituições necessárias antes de remover o pagamento:

- Com saldo pendente, o valor excluído volta a esse saldo.
- Depois da quitação, excluir uma parcela anterior preserva a parcela final em um registro separado e reabre somente o valor excluído.
- Excluir a parcela final primeiro cria uma nova pendência e transfere os vínculos das parcelas restantes.
- O identificador excluído não é reutilizado; repetir a exclusão não duplica valores.
- Pendências com pagamentos vinculados não podem ser apagadas antes deles.

`applyDemoChange` valida e constrói o próximo estado sem alterar o estado anterior. React só recebe o resultado quando todas as etapas terminam. Não há gravação parcial ou transação em banco nesta versão.

## Exemplo disponível

“Projeto fictício” foi quitado com R$ 300 e R$ 700. Exclua qualquer uma das duas parcelas em Movimentações e confira o saldo em Entradas e freelas. Reinicie a demonstração para testar a ordem inversa.

Os testes unitários e os testes de navegador verificam ambas as ordens, conservação dos centavos, vínculos e data prevista.
