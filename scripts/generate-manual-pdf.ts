import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

// Define the manual content
const TITLE = "Manual Estratégico: Investment Advisor";
const SUBTITLE = "A ponte entre tecnologia de ponta e sua liberdade financeira";

const SECTIONS = [
    {
        title: "LIVRO I: A FILOSOFIA DA ANTIGRAVIDADE FINANCEIRA",
        content: [
            "O Investment Advisor não é apenas um software; é um manifesto contra a paralisia decisória. Em um mundo saturado de ruído, esta plataforma atua como um filtro de frequência, permitindo que apenas a essência estratégica chegue ao seu conhecimento.",
            "",
            "A filosofia Antigravity baseia-se na ideia de que o seu patrimônio deve ter uma estrutura tão sólida que as flutuações de mercado não o afetem emocionalmente. Para isso, dividimos a inteligência em dois hemisférios:",
            "1. My Blueprint: Onde reside a sua verdade financeira (Ativos, Passivos e Regras).",
            "2. Market Intelligence: Onde a IA processa o caos do mundo para servir à sua estratégia.",
            "",
            "Este manual de 50 páginas é o seu mapa de guerra. Estude-o, pois ele contém a chave para a soberania sobre o seu capital."
        ],
        subsections: [
            {
                subtitle: "O Manifesto Antigravity Financeira",
                body: "Nossa visão estratégica propõe que o investidor pare de olhar para o preço e comece a olhar para o valor intrínseco e para a correlação. Através do sistema de 'Data-First', garantimos que cada decisão venha acompanhada de uma trilha de auditoria completa, protegendo o usuário de impulsos emocionais."
            },
            {
                subtitle: "Registro de Componentes UI - Landing Page (Home)",
                body: "A tela inicial é o primeiro portal de comando. Abaixo estão os componentes interativos fundamentais:\n• Botão 'Investment Mode': Direciona para o Dashboard principal focado em portfólio.\n• Botão 'Financial Advisor Mode': Ativa ferramentas de assessoria para múltiplos clientes.\n• Botão 'Chat Guru Access': Atalho para consulta imediata com a IA.\n• Seletor de Idioma: Permite alternar entre as 3 línguas suportadas para relatórios.\n• Ícone de Login/Signup: Portal de entrada segura."
            }
        ]
    },
    {
        title: "LIVRO II: NAVEGAÇÃO E ESPAÇO DE TRABALHO DE ELITE",
        subsections: [
            {
                subtitle: "A Barra de Comando Global",
                body: "Localizada no topo de todas as telas, ela é sua bússola constante.\n• Logo 'Investment Advisor': Reseta o contexto e retorna ao Dashboard central.\n• Busca Inteligente [CMD + K]: Não é uma busca simples. Você pode digitar 'Ver ações de dividendos' ou 'Quanto tenho em CDB?' e o sistema te levará ao dado exato.\n• Notificações de Impacto: O sino no canto superior direito só toca para eventos de alta prioridade (Ex: Rebalanceamento Urgente ou Notícia Crítica)."
            },
            {
                subtitle: "O Menu Lateral de Navegação (Sidebar)",
                body: "O centro nervoso de acesso rápido:\n• Link 'Dashboard': Visão geral de patrimônio.\n• Link 'Minha Carteira': Lista de ativos e My Blueprint.\n• Link 'Linha do Tempo': Acesso ao Time Machine e Auditoria.\n• Link 'Configurações': Ajustes de sistema e API Keys.\n• Ícone de Minimizar Sidebar: Maximiza o espaço útil para gráficos densos."
            }
        ]
    },
    {
        title: "LIVRO III: DASHBOARD - O CENTRO DE COMANDO EXECUTIVO",
        subsections: [
            {
                subtitle: "Widgets de Dados Dinâmicos",
                body: "Cada widget é um componente reativo:\n• Widget 'Net Worth': Exibe o valor total consolidado. O botão 'Expand' no canto superior direito abre o detalhamento histórico.\n• Widget 'Risco vs. Retorno': Gráfico de dispersão clicável. Clique em um ativo para ver sua correlação individual.\n• Widget de 'Alertas Ativos': Lista de pendências urgentes (Checkboxes para marcar como lidas)."
            },
            {
                subtitle: "Botões de Ação Imediata",
                body: "• Botão 'Atualizar' (Refresh): No canto superior, força a busca de cotações em tempo real.\n• Botão 'Baixar PDF Rápido': Gera um snapshot de uma única página do que está visível no momento.\n• Filtro 'Ativo/Passivo': Toggle que permite olhar apenas o que render ou apenas o que custa na sua carteira."
            }
        ]
    },
    {
        title: "LIVRO IV: MY BLUEPRINT - SUMÁRIO FINANCEIRO GRANULAR",
        subsections: [
            {
                subtitle: "Componentes UI da Gestão de Ativos",
                body: "Dentro do My Blueprint, você encontrará os seguintes controles:\n• Botão '[+] Adicionar Ativo': Abre o modal 'AddAssetModal' com campos de Nome, Tipo (Dropdown), Valor e Custodiante.\n• Botão 'Importar Extrato PDF': O ponto de entrada para o motor OCR. Suporta arquivos de todos os grandes bancos brasileiros.\n• Tabelas de Ativos: Note que os cabeçalhos (Nome, Ticker, Valor) são clicáveis para ordenação ASC/DESC."
            },
            {
                subtitle: "Interatividade em Nível de Item",
                body: "• Ícone 'Lápis' (Editar): Permite ajuste manual de preço médio ou quantidade.\n• Ícone 'Lixeira' (Excluir): Remove o ativo, disparando um log de auditoria automático.\n• Badge de 'Status de Risco': Clicável para abrir a justificativa da IA sobre o porquê daquele ativo ser considerado arriscado."
            }
        ]
    },
    {
        title: "LIVRO V: TIME MACHINE E REVERSÃO DE CASCATA",
        subsections: [
            {
                subtitle: "Componentes de Viagem no Tempo",
                body: "A interface do Time Machine é focada em visualização histórica:\n• Slider de Data (Horizontal): Permite navegar ano a ano ou mês a mês pelo histórico.\n• Botão 'Definir como Base Atual': Dispara o motor de 'Rollback' total da base de dados.\n• Cards de Snapshot: Pequenos cards que exibem o resumo do patrimônio na data selecionada."
            },
            {
                subtitle: "Visualização de Auditoria (Audit Trail UI)",
                body: "• Tabela de Logs: Exibe 'Quem', 'Quando' e 'O quê'.\n• Botão 'Ver JSON': No final de cada linha, permite ao usuário avançado ver o diff técnico da operação.\n• Filtro de Gravidade: Alterna entre LOGS Informativos, Avisos e Erros Críticos."
            }
        ]
    },
    {
        title: "LIVRO VI: O CONSULTOR IA GURU - CHAT E PERSONAS",
        subsections: [
            {
                subtitle: "Interface de Chat Estratégico",
                body: "O chat não é apenas texto:\n• Campo de Entrada (Prompt): Aceita comandos como /help ou /analyze.\n• Botão 'Anexar Contexto': Permite enviar documentos adicionais (ex: Notícias) para a IA analisar.\n• Botão de 'Microfone': Inicia a transcrição de voz para busca mãos-livres."
            },
            {
                subtitle: "Sistema de Personas Customizáveis",
                body: "• Seletor de Persona: Alterne no menu suspenso entre perfis conservadores ou agressivos.\n• Toggle 'Regras de Ouro': Ativa/Desativa o modo de conselhos estritos baseados em livros clássicos (A Bíblia do Investidor).\n• Histórico de Transcrições: Lista lateral clicável para recuperar conselhos passados."
            }
        ]
    },
    {
        title: "LIVRO VII: ANÁLISE DE RISCO E MONTE CARLO",
        subsections: [
            {
                subtitle: "Simuladores de Estresse Financeiro",
                body: "Controles do Simulador:\n• Botão 'Simular Monte Carlo': O coração do processo estatístico.\n• Input 'Meta Financeira': Campo numérico para definir o objetivo final.\n• Slider 'Nível de Confiança': Define se você quer uma probabilidade de 95% ou 99% de sucesso."
            },
            {
                subtitle: "Visualizações de Interpolação",
                body: "• Gráfico de 'Funil de Fortuna': Mostra os caminhos prováveis do seu capital no futuro. Clicável para ver o pior cenário possível.\n• Tabela de Fatores de Correlação: Lista o 'R' de correlação entre seus ativos. Clicar em um fator sugere ativos de diversificação."
            }
        ]
    },
    {
        title: "LIVRO VIII: INTEGRAÇÃO BANCÁRIA E OCR DE PDFs",
        subsections: [
            {
                subtitle: "Painel de Conectividade Bancária",
                body: "Onde o mundo externo encontra o sistema:\n• Botão 'Conectar Novo Banco': Inicia o fluxo OAuth da Plaid ou Belvo.\n• Área 'Solte seu PDF aqui': Zona de Drag-and-drop para arquivos bancários.\n• Botão 'Limpar Arquivos Adicionados': Reseta o buffer de importação."
            },
            {
                subtitle: "Componentes de Validação de Dados",
                body: "• Tabela de Prévia: Exibe os dados que a IA extraiu. Clique em QUALQUER célula para editar manualmente antes de salvar.\n• Badge de 'Confiança OCR': Mostra a porcentagem de certeza da extração. Clique para ver a imagem original destacada."
            }
        ]
    },
    {
        title: "LIVRO IX: RELATÓRIOS E COMPARTILHAMENTO",
        subsections: [
            {
                subtitle: "Studio de Exportação de Inteligência",
                body: "Customizando seu relatório:\n• Checkbox 'Incluir Notas de IA': Seletor para adicionar os conselhos do Guru ao documento final.\n• Dropdown de Formato: Escolha entre PDF Profissional, CSV Bruto ou JSON de Exportação.\n• Botão 'Salvar no Drive': Integração direta com Google Drive ou Dropbox."
            },
            {
                subtitle: "Interatividade em Gráficos de Relatório",
                body: "• Seletor de Período: Datas rápidas (YTD, 1Y, 5Y).\n• Botão 'Enviar para Household': Compartilha instantaneamente o relatório com membros da família vinculados no perfil."
            }
        ]
    },
    {
        title: "LIVRO X: SEGURANÇA, CRIPTOGRAFIA E PRIVACIDADE",
        subsections: [
            {
                subtitle: "Painel de Controle de Segurança (UI)",
                body: "• Toggle 'Private Mode': Esconde valores numéricos do dashboard. Ative com a tecla de atalho [H].\n• Botão 'Garantir Chaves de API': Abre o modal de entrada de segredos (OpenAI, MarketData).\n• Botão 'Encerrar Sessões Ativas': Força logoff em todos os outros dispositivos."
            },
            {
                subtitle: "Conformidade LGPD",
                body: "• Botão 'Solicitar Todos os Meus Dados': Gera um pacote compactado com toda sua trilha financeira conforme a lei.\n• Checklist de Termos de Uso: Aceite e revisão manual de políticas de privacidade."
            }
        ]
    },
    {
        title: "LIVRO XI: ADMINISTRAÇÃO DE PERFIL E HOUSEHOLDS",
        subsections: [
            {
                subtitle: "Gestão de Identidade UI",
                body: "• Input 'Nome de Exibição': Personaliza como o Guru te chama.\n• Botão 'Mudar Foto': Upload de avatar via interface padrão do sistema.\n• Badge de 'Nível de Assinatura': Exibe se você é usuário Free, Pro ou Elite."
            },
            {
                subtitle: "Configuração Familiar (Households)",
                body: "• Botão '+ Convidar Membro': Abre o fluxo de convites via link ou e-mail.\n• Dropdown de Permissões: Escolha entre Administrador ou apenas Visualizador.\n• Botão 'Sincronizar Carteiras': Consolida ativos de dois ou mais membros em um único dashboard familiar."
            }
        ]
    },
    {
        title: "LIVRO XII: CONFIGURAÇÕES GLOBAIS DO SISTEMA",
        subsections: [
            {
                subtitle: "Personalização de Experiência UI",
                body: "• Switch 'Modo Escuro': Muda o tema visual da plataforma.\n• Seletor de 'Moeda Padrão': Define se os cálculos principais usam BRL, USD ou EUR.\n• Input 'Custom AI Prompt': Campo de texto avançado para injetar instruções persistentes na inteligência."
            },
            {
                subtitle: "Gestão de Alertas e Notificações",
                body: "• Checkbox 'Alertas por SMS': Ativa notificações de preço SMS.\n• Slider de 'Volume de Notificações': Ajusta a sensibilidade dos alertas (Silencioso até Informativo)."
            }
        ]
    },
    {
        title: "LIVRO XIII: SUPORTE, AJUDA E DOCUMENTAÇÃO",
        subsections: [
            {
                subtitle: "Centro de Ajuda ao Estrategista",
                body: "• Barra de Pesquisa de Suporte: Busca em tempo real nesta documentação.\n• Botão 'Tour Guiado': Inicia o passo a passo interativo que apresenta cada botão da interface.\n• Link 'Falar com Desenvolvedor': Abre canal direto para bugs ou sugestões críticas."
            },
            {
                subtitle: "Status de Saúde do Sistema",
                body: "• Indicadores de Conectividade: Badge verde/vermelho para cada API de mercado integrada.\n• Versão do Sistema: Informação técnica sobre a build atual no rodapé do painel de suporte."
            }
        ]
    }
];

function generatePDF() {
    console.log("Generating manual PDF...");
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const primaryColor = [26, 54, 93]; // Deep Blue
    const secondaryColor = [74, 85, 104]; // Slate
    const accentColor = [49, 130, 206]; // Blue 500

    let cursorY = 20;
    const marginX = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    function drawFooter(pageNumber: number) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        const footerLeft = `Investment Advisor AI - Strategic Manual`;
        const footerRight = `Página ${pageNumber}`;
        doc.text(footerLeft, marginX, pageHeight - 10);
        doc.text(footerRight, pageWidth - marginX - 20, pageHeight - 10);
    }

    // Title Section
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(1.5);
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(TITLE, marginX, cursorY);
    cursorY += 10;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(SUBTITLE, marginX, cursorY);
    cursorY += 20;

    let currentPage = 1;
    drawFooter(currentPage);

    SECTIONS.forEach((section, index) => {
        // Section Title
        if (cursorY > 240) {
            doc.addPage();
            currentPage++;
            cursorY = 30;
            drawFooter(currentPage);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(section.title, marginX, cursorY);
        cursorY += 12;

        if (section.content) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            section.content.forEach(line => {
                const lines = doc.splitTextToSize(line, pageWidth - (marginX * 2));
                doc.text(lines, marginX, cursorY);
                cursorY += (lines.length * 7);
            });
            cursorY += 5;
        }

        if (section.subsections) {
            section.subsections.forEach(sub => {
                if (cursorY > 240) {
                    doc.addPage();
                    currentPage++;
                    cursorY = 30;
                    drawFooter(currentPage);
                }

                // Subtitle Box
                doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.setLineWidth(0.5);
                doc.line(marginX, cursorY - 2, marginX + 10, cursorY - 2);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(13);
                doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.text(sub.subtitle, marginX, cursorY + 4);
                cursorY += 12;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10.5);
                doc.setTextColor(60, 60, 60);
                const bodyLines = doc.splitTextToSize(sub.body, pageWidth - (marginX * 2));
                doc.text(bodyLines, marginX, cursorY);
                cursorY += (bodyLines.length * 6) + 8;
            });
        }
        cursorY += 10;
    });

    const outputDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'Investment_Advisor_Manual_PTBR.pdf');
    const pdfOutput = doc.output('arraybuffer');
    fs.writeFileSync(outputPath, Buffer.from(pdfOutput));

    console.log(`Manual generated successfully at: ${outputPath}`);
}

generatePDF();

