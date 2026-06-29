document.addEventListener('DOMContentLoaded', () => {
    // Inicializar ícones do Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Elementos do DOM - Estados principais
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const editorZone = document.getElementById('editor-zone');
    const processingZone = document.getElementById('processing-zone');
    const successZone = document.getElementById('success-zone');

    // Elementos do DOM - Informações do arquivo
    const fileNameText = document.getElementById('file-name');
    const fileSizeText = document.getElementById('file-size');
    const totalPagesBadge = document.getElementById('total-pages-badge');
    const btnReset = document.getElementById('btn-reset');

    // Elementos do DOM - Modos e Configurações
    const modeOptions = document.querySelectorAll('.mode-option');
    const settingsGroups = document.querySelectorAll('.settings-group');
    const btnProcess = document.getElementById('btn-process-pdf');

    // Configurações do Intervalo Personalizado
    const inputCustomRanges = document.getElementById('input-custom-ranges');
    const customRangesPreview = document.getElementById('custom-ranges-preview');
    const customRangesError = document.getElementById('custom-ranges-error');
    const checkboxSeparatePages = document.getElementById('checkbox-separate-pages');

    // Configurações do Intervalo Fixo (Divisão uniforme)
    const inputFixedCount = document.getElementById('input-fixed-count');
    const btnStepDown = document.getElementById('btn-step-down');
    const btnStepUp = document.getElementById('btn-step-up');
    const fixedRangesSummary = document.getElementById('fixed-ranges-summary');

    // Elementos do DOM - Processamento e Sucesso
    const progressBarFill = document.getElementById('progress-bar-fill');
    const processingStatusText = document.getElementById('processing-status-text');
    const successMessage = document.getElementById('success-message');
    const btnDownloadAgain = document.getElementById('btn-download-again');
    const btnStartOver = document.getElementById('btn-start-over');

    // Estado da Aplicação
    let selectedFile = null;
    let fileArrayBuffer = null;
    let pdfDoc = null;
    let totalPages = 0;
    let parsedCustomRanges = []; // Array de arrays contendo números das páginas
    let processedResult = {
        blob: null,
        filename: ''
    };

    // ----------------------------------------------------
    // 1. EVENTOS DE UPLOAD (Drag & Drop + Input File)
    // ----------------------------------------------------

    // Prevenir que o navegador abra o PDF ao arrastar para fora da área
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Clique na zona de upload abre o seletor de arquivos
    uploadZone.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Eventos de arrastar arquivo
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, (e) => {
            uploadZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, (e) => {
            uploadZone.classList.remove('dragover');
        }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    // Reset da aplicação (escolher outro arquivo)
    btnReset.addEventListener('click', () => {
        resetApp();
    });

    btnStartOver.addEventListener('click', () => {
        resetApp();
    });

    // ----------------------------------------------------
    // 2. PROCESSAMENTO DO ARQUIVO SELECIONADO
    // ----------------------------------------------------
    async function handleFileSelection(file) {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Por favor, selecione apenas arquivos no formato PDF.');
            return;
        }

        selectedFile = file;
        
        // Exibir feedback visual de carregamento inicial
        fileNameText.textContent = selectedFile.name;
        fileSizeText.textContent = formatBytes(selectedFile.size);
        
        try {
            // Mostrar tela de processamento temporário rápido
            showZone(processingZone);
            processingStatusText.textContent = 'Carregando documento PDF...';
            progressBarFill.style.width = '20%';

            fileArrayBuffer = await readFileAsArrayBuffer(selectedFile);
            progressBarFill.style.width = '50%';

            // Carregar PDF usando pdf-lib
            if (typeof PDFLib === 'undefined') {
                throw new Error('A biblioteca PDF-Lib não pôde ser carregada do CDN. Verifique sua conexão.');
            }

            pdfDoc = await PDFLib.PDFDocument.load(fileArrayBuffer, { ignoreEncryption: true });
            totalPages = pdfDoc.getPageCount();
            progressBarFill.style.width = '100%';

            if (totalPages === 0) {
                throw new Error('O arquivo PDF está vazio (não possui páginas).');
            }

            // Configurar os limites dos inputs baseados no total de páginas
            totalPagesBadge.textContent = totalPages;
            inputFixedCount.max = totalPages;
            inputFixedCount.value = 1;

            // Limpar inputs
            inputCustomRanges.value = '';
            customRangesPreview.innerHTML = '';
            customRangesError.classList.add('hidden');
            
            // Atualizar o resumo de intervalos fixos
            updateFixedRangesSummary();

            // Atualizar layout com dados do PDF
            showZone(editorZone);
        } catch (error) {
            console.error('Erro ao ler PDF:', error);
            alert(`Erro ao abrir PDF: ${error.message || 'Arquivo corrompido ou protegido por senha.'}`);
            resetApp();
        }
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    // ----------------------------------------------------
    // 3. EVENTOS DE CONFIGURAÇÃO DE MODO
    // ----------------------------------------------------
    modeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            // Remover classe ativa de todas
            modeOptions.forEach(opt => opt.classList.remove('active'));
            // Adicionar classe ativa no elemento clicado
            option.classList.add('active');

            const radio = option.querySelector('input[type="radio"]');
            radio.checked = true;

            const modeValue = radio.value;

            // Alternar visibilidade das configurações
            settingsGroups.forEach(group => {
                if (group.id === `settings-${modeValue}`) {
                    group.classList.remove('hidden');
                    group.classList.add('active-settings');
                } else {
                    group.classList.add('hidden');
                    group.classList.remove('active-settings');
                }
            });

            validateCurrentMode();
        });
    });

    // ----------------------------------------------------
    // 4. LÓGICA DO MODO: INTERVALOS PERSONALIZADOS
    // ----------------------------------------------------
    inputCustomRanges.addEventListener('input', () => {
        validateCustomRanges();
    });

    function validateCustomRanges() {
        const value = inputCustomRanges.value.trim();
        customRangesPreview.innerHTML = '';
        
        if (value === '') {
            parsedCustomRanges = [];
            customRangesError.classList.add('hidden');
            btnProcess.disabled = false;
            return;
        }

        // Permitir espaços, vírgulas, números e hifens
        const isValidCharacters = /^[0-9\s,-]+$/.test(value);
        if (!isValidCharacters) {
            showCustomRangeError('Caracteres inválidos detectados. Use apenas números, vírgulas e hifens.');
            return;
        }

        const parts = value.split(',');
        const ranges = [];
        let hasError = false;

        for (let part of parts) {
            part = part.trim();
            if (part === '') continue;

            if (part.includes('-')) {
                // Intervalo (ex: 1-3)
                const rangeParts = part.split('-');
                if (rangeParts.length !== 2) {
                    hasError = true;
                    break;
                }
                const start = parseInt(rangeParts[0].trim(), 10);
                const end = parseInt(rangeParts[1].trim(), 10);

                if (isNaN(start) || isNaN(end) || start < 1 || end < 1 || start > totalPages || end > totalPages || start > end) {
                    hasError = true;
                    break;
                }

                // Adicionar páginas do intervalo
                const pages = [];
                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }
                ranges.push({ label: `${start}-${end}`, pages });
            } else {
                // Página única (ex: 5)
                const pageNum = parseInt(part, 10);
                if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
                    hasError = true;
                    break;
                }
                ranges.push({ label: `${pageNum}`, pages: [pageNum] });
            }
        }

        if (hasError) {
            showCustomRangeError(`Intervalo inválido. Certifique-se de usar páginas entre 1 e ${totalPages}.`);
            parsedCustomRanges = [];
            return;
        }

        // Se estiver tudo OK, exibir os chips de preview
        customRangesError.classList.add('hidden');
        btnProcess.disabled = false;

        parsedCustomRanges = ranges.map(r => r.pages);

        ranges.forEach(r => {
            const chip = document.createElement('span');
            chip.className = 'range-chip';
            chip.textContent = `Págs ${r.label} (${r.pages.length} pág${r.pages.length > 1 ? 's' : ''})`;
            customRangesPreview.appendChild(chip);
        });
    }

    function showCustomRangeError(msg) {
        customRangesError.textContent = msg;
        customRangesError.classList.remove('hidden');
        btnProcess.disabled = true;
        parsedCustomRanges = [];
    }

    // ----------------------------------------------------
    // 5. LÓGICA DO MODO: DIVISÃO EM PARTES IGUAIS (INTERVALO FIXO)
    // ----------------------------------------------------
    inputFixedCount.addEventListener('change', () => {
        sanitizeFixedCount();
        updateFixedRangesSummary();
    });

    inputFixedCount.addEventListener('input', () => {
        sanitizeFixedCount();
        updateFixedRangesSummary();
    });

    btnStepDown.addEventListener('click', () => {
        let val = parseInt(inputFixedCount.value, 10) || 1;
        if (val > 1) {
            inputFixedCount.value = val - 1;
            updateFixedRangesSummary();
        }
    });

    btnStepUp.addEventListener('click', () => {
        let val = parseInt(inputFixedCount.value, 10) || 1;
        if (val < totalPages) {
            inputFixedCount.value = val + 1;
            updateFixedRangesSummary();
        }
    });

    function sanitizeFixedCount() {
        let val = parseInt(inputFixedCount.value, 10);
        if (isNaN(val) || val < 1) {
            inputFixedCount.value = 1;
        } else if (val > totalPages) {
            inputFixedCount.value = totalPages;
        }
    }

    function updateFixedRangesSummary() {
        const x = parseInt(inputFixedCount.value, 10) || 1;
        const totalFiles = Math.ceil(totalPages / x);
        
        let text = '';
        if (totalFiles === 1) {
            text = `O documento todo será mantido em 1 único arquivo com ${totalPages} páginas (nenhuma divisão real será feita).`;
        } else {
            const lastFilePages = totalPages % x === 0 ? x : totalPages % x;
            if (x === 1) {
                text = `O documento será dividido em ${totalFiles} arquivos de 1 página cada.`;
            } else {
                text = `O documento será dividido em ${totalFiles} arquivos: ${totalFiles - 1} partes de ${x} páginas e 1 parte final de ${lastFilePages} página(s).`;
            }
        }
        fixedRangesSummary.textContent = text;
    }

    function validateCurrentMode() {
        const activeMode = document.querySelector('input[name="split-mode"]:checked').value;
        if (activeMode === 'custom-ranges') {
            validateCustomRanges();
        } else {
            btnProcess.disabled = false;
        }
    }

    // ----------------------------------------------------
    // 6. PROCESSAMENTO E GERAÇÃO DE NOVOS PDFs
    // ----------------------------------------------------
    btnProcess.addEventListener('click', async () => {
        const activeMode = document.querySelector('input[name="split-mode"]:checked').value;
        let finalRanges = []; // Array de arrays com páginas 1-indexed

        if (activeMode === 'extract-all') {
            for (let i = 1; i <= totalPages; i++) {
                finalRanges.push([i]);
            }
        } else if (activeMode === 'custom-ranges') {
            if (parsedCustomRanges.length === 0) {
                alert('Por favor, defina um intervalo de páginas válido primeiro.');
                return;
            }
            if (checkboxSeparatePages && checkboxSeparatePages.checked) {
                // Achatar os intervalos para que cada página seja um arquivo separado
                finalRanges = parsedCustomRanges.flat().map(page => [page]);
            } else {
                finalRanges = parsedCustomRanges;
            }
        } else if (activeMode === 'fixed-ranges') {
            const x = parseInt(inputFixedCount.value, 10) || 1;
            let currentRange = [];
            for (let i = 1; i <= totalPages; i++) {
                currentRange.push(i);
                if (currentRange.length === x || i === totalPages) {
                    finalRanges.push(currentRange);
                    currentRange = [];
                }
            }
        }

        if (finalRanges.length === 0) {
            alert('Nenhum arquivo a ser gerado. Verifique suas configurações.');
            return;
        }

        try {
            // Ir para tela de processamento
            showZone(processingZone);
            progressBarFill.style.width = '0%';
            processingStatusText.textContent = `Preparando para criar ${finalRanges.length} arquivos...`;

            // Timeout pequeno para o navegador renderizar a tela de loading
            await new Promise(resolve => setTimeout(resolve, 300));

            const generatedFiles = [];
            const baseFileName = selectedFile.name.replace(/\.[^/.]+$/, "");

            for (let index = 0; index < finalRanges.length; index++) {
                const pageList = finalRanges[index];
                processingStatusText.textContent = `Processando arquivo ${index + 1} de ${finalRanges.length} (Páginas: ${pageList.join(', ')})...`;
                
                // Criar novo PDF Document
                const newPdf = await PDFLib.PDFDocument.create();
                
                // Copiar páginas do PDF original (lembrando que pdf-lib usa índices base-0)
                const zeroIndexedPages = pageList.map(p => p - 1);
                const copiedPages = await newPdf.copyPages(pdfDoc, zeroIndexedPages);
                
                // Adicionar páginas ao novo documento
                for (const page of copiedPages) {
                    newPdf.addPage(page);
                }
                
                // Salvar o novo arquivo PDF
                const newPdfBytes = await newPdf.save();
                const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
                
                // Formular nome do arquivo
                let outputName = `${baseFileName}_parte_${index + 1}.pdf`;
                if (activeMode === 'custom-ranges') {
                    // Nome mais descritivo baseado no intervalo
                    const rangeLabel = pageList.length === 1 ? `pag_${pageList[0]}` : `pags_${pageList[0]}_a_${pageList[pageList.length - 1]}`;
                    outputName = `${baseFileName}_${rangeLabel}.pdf`;
                } else if (activeMode === 'extract-all') {
                    outputName = `${baseFileName}_pag_${pageList[0]}.pdf`;
                }

                generatedFiles.push({
                    blob: blob,
                    name: outputName
                });

                // Atualizar barra de progresso do PDF-Lib
                const progressPercentage = Math.floor(((index + 1) / finalRanges.length) * 80);
                progressBarFill.style.width = `${progressPercentage}%`;
                
                // Deixar o navegador respirar para evitar travamentos
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Resolver o download: Se for 1 único arquivo, baixar direto. Se forem múltiplos, criar ZIP.
            if (generatedFiles.length === 1) {
                const singleFile = generatedFiles[0];
                processedResult.blob = singleFile.blob;
                processedResult.filename = singleFile.name;
                
                progressBarFill.style.width = '100%';
                triggerDownload(processedResult.blob, processedResult.filename);
                
                successMessage.textContent = `O arquivo "${processedResult.filename}" foi baixado no seu navegador.`;
            } else {
                processingStatusText.textContent = 'Empacotando arquivos em um arquivo ZIP...';
                
                if (typeof JSZip === 'undefined') {
                    throw new Error('A biblioteca JSZip não pôde ser carregada. Não foi possível criar o arquivo compactado.');
                }

                const zip = new JSZip();
                generatedFiles.forEach(file => {
                    zip.file(file.name, file.blob);
                });

                // Gerar o zip com feedback de progresso
                const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
                    const zipProgress = 80 + Math.floor(metadata.percent * 0.2);
                    progressBarFill.style.width = `${zipProgress}%`;
                    processingStatusText.textContent = `Criando ZIP: ${Math.floor(metadata.percent)}% completo...`;
                });

                processedResult.blob = zipBlob;
                processedResult.filename = `${baseFileName}_dividido.zip`;

                triggerDownload(processedResult.blob, processedResult.filename);
                successMessage.textContent = `O arquivo ZIP contendo as ${generatedFiles.length} partes foi baixado.`;
            }

            // Exibir tela de sucesso
            showZone(successZone);
        } catch (error) {
            console.error('Erro durante o processamento do PDF:', error);
            alert(`Ocorreu um erro ao processar o PDF: ${error.message || error}`);
            showZone(editorZone);
        }
    });

    btnDownloadAgain.addEventListener('click', () => {
        if (processedResult.blob && processedResult.filename) {
            triggerDownload(processedResult.blob, processedResult.filename);
        }
    });

    // ----------------------------------------------------
    // 7. FUNÇÕES AUXILIARES / UTILITÁRIAS
    // ----------------------------------------------------
    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Limpar recursos da memória
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    function showZone(zoneToShow) {
        [uploadZone, editorZone, processingZone, successZone].forEach(zone => {
            if (zone) {
                zone.classList.add('hidden');
            }
        });
        zoneToShow.classList.remove('hidden');
    }

    function resetApp() {
        selectedFile = null;
        fileArrayBuffer = null;
        pdfDoc = null;
        totalPages = 0;
        parsedCustomRanges = [];
        processedResult = { blob: null, filename: '' };
        
        fileInput.value = '';
        showZone(uploadZone);
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
