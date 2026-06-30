document.addEventListener('DOMContentLoaded', () => {
    // Configure PDF.js Worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // Initialize Lucide Icons
    function refreshIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    refreshIcons();

    // Application State
    const state = {
        activeTool: 'split', // Active tool key
        files: [], // Array of objects: { fileObject, name, size, arrayBuffer }
        totalPages: 0,
        pdfDocLib: null, // pdf-lib PDFDocument instance
        pdfJsDoc: null, // pdf.js PDFDocumentProxy instance
        pageRotations: {}, // pageNum (1-indexed) -> degrees (0, 90, 180, 270)
        deletedPages: new Set(), // Set of page numbers (1-indexed) deleted
        sortablePages: null, // SortableJS instance for pages grid
        sortableFiles: null, // SortableJS instance for files list
        signatures: [], // Array of base64 images representing signatures
        selectedSignature: null, // Selected signature image element
        draggedSigCoords: { x: 50, y: 50, width: 120, height: 50, page: 1 },
        signatureCanvasPad: null, // SignaturePad instance
        currentEditPage: 1, // Current viewing page in signature editor
        formFields: [], // Extracted interactive fields
        processedResult: { blob: null, filename: '' }
    };

    // Tool metadata descriptions
    const toolMeta = {
        split: { title: "Dividir PDF", subtitle: "Extraia páginas específicas ou divida o seu documento em vários arquivos PDF individuais." },
        merge: { title: "Juntar PDFs", subtitle: "Combine vários arquivos PDF em um único documento na ordem que preferir." },
        compress: { title: "Comprimir PDF", subtitle: "Reduza o tamanho do seu arquivo PDF mantendo a melhor qualidade visual." },
        'pdf-to-img': { title: "PDF para Imagem", subtitle: "Converta as páginas do seu documento PDF em imagens PNG ou JPG." },
        'img-to-pdf': { title: "Imagem para PDF", subtitle: "Converta suas imagens JPG ou PNG em um documento PDF unificado." },
        rotate: { title: "Rotacionar PDF", subtitle: "Gire as páginas do seu documento PDF nos ângulos desejados." },
        organize: { title: "Organizar PDF", subtitle: "Altere a ordem das páginas do seu PDF ou remova as que não precisa." },
        watermark: { title: "Adicionar Marca d'Água", subtitle: "Aplique marcas d'água de texto ou imagem nas páginas do seu documento." },
        'page-numbers': { title: "Numerar Páginas", subtitle: "Insira números de páginas no cabeçalho ou rodapé do seu PDF." },
        protect: { title: "Proteger PDF", subtitle: "Criptografe seu arquivo definindo uma senha de abertura forte." },
        sign: { title: "Assinar PDF", subtitle: "Crie uma assinatura desenhada ou digitada e posicione-a livremente nas páginas." },
        'fill-form': { title: "Preencher Formulário", subtitle: "Preencha os campos interativos do seu arquivo PDF de forma local e segura." },
        ocr: { title: "Extrair Texto (OCR)", subtitle: "Copie textos nativos ou utilize OCR para extrair texto de PDFs escaneados." }
    };

    // DOM Elements - Navigation
    const dashboardView = document.getElementById('dashboard-view');
    const workspaceView = document.getElementById('workspace-view');
    const btnBackHome = document.getElementById('btn-back-home');
    const workspaceTitle = document.getElementById('workspace-title');
    const workspaceSubtitle = document.getElementById('workspace-subtitle');

    // DOM Elements - Tool UI Zones
    const uploadZone = document.getElementById('upload-zone');
    const uploadZoneIcon = document.getElementById('upload-zone-icon');
    const uploadZoneTitle = document.getElementById('upload-zone-title');
    const uploadZoneSubtitle = document.getElementById('upload-zone-subtitle');
    const uploadZoneHint = document.getElementById('upload-zone-hint');
    const fileInput = document.getElementById('file-input');
    
    const editorZone = document.getElementById('editor-zone');
    const fileNameText = document.getElementById('file-name');
    const fileSizeText = document.getElementById('file-size');
    const btnReset = document.getElementById('btn-reset');
    
    const processingZone = document.getElementById('processing-zone');
    const processingStatusText = document.getElementById('processing-status-text');
    const progressBarFill = document.getElementById('progress-bar-fill');
    
    const successZone = document.getElementById('success-zone');
    const successMessage = document.getElementById('success-message');
    const btnDownloadAgain = document.getElementById('btn-download-again');
    const btnStartOver = document.getElementById('btn-start-over');
    
    const textOutputZone = document.getElementById('text-output-zone');
    const extractedTextArea = document.getElementById('extracted-text-area');
    const btnCopyExtractedText = document.getElementById('btn-copy-extracted-text');

    // DOM Elements - Config Panels / Left Panel Areas
    const docSummaryCard = document.getElementById('doc-summary-card');
    const totalPagesBadge = document.getElementById('total-pages-badge');
    const multiFileListContainer = document.getElementById('multi-file-list-container');
    const multiFileCount = document.getElementById('multi-file-count');
    const fileListItems = document.getElementById('file-list-items');
    const btnAddMoreFiles = document.getElementById('btn-add-more-files');
    const addMoreFilesInput = document.getElementById('add-more-files-input');
    
    const pagesGridContainer = document.getElementById('pages-grid-container');
    const pagesGrid = document.getElementById('pages-grid');
    
    const canvasEditorContainer = document.getElementById('canvas-editor-container');
    const editorPdfCanvas = document.getElementById('editor-pdf-canvas');
    const canvasViewport = document.getElementById('canvas-viewport');
    const draggableSignature = document.getElementById('draggable-signature');
    const signatureImgPreview = document.getElementById('signature-img-preview');
    const btnDeleteSig = document.getElementById('btn-delete-sig');
    const btnPrevPage = document.getElementById('btn-prev-page');
    const btnNextPage = document.getElementById('btn-next-page');
    const currentEditPageSpan = document.getElementById('current-edit-page');
    const totalEditPagesSpan = document.getElementById('total-edit-pages');

    // Right config panels wrapper
    const settingsGroups = document.querySelectorAll('.settings-group');
    const btnProcess = document.getElementById('btn-process-pdf');
    const btnProcessIcon = document.getElementById('btn-process-icon');
    const btnProcessText = document.getElementById('btn-process-text');

    // Tool config fields
    // Split
    const inputCustomRanges = document.getElementById('input-custom-ranges');
    const customRangesPreview = document.getElementById('custom-ranges-preview');
    const customRangesError = document.getElementById('custom-ranges-error');
    const checkboxSeparatePages = document.getElementById('checkbox-separate-pages');
    const inputFixedCount = document.getElementById('input-fixed-count');
    const btnStepDown = document.getElementById('btn-step-down');
    const btnStepUp = document.getElementById('btn-step-up');
    const fixedRangesSummary = document.getElementById('fixed-ranges-summary');
    const splitSettingsDetails = document.getElementById('split-settings-details');
    // Compress
    const compressRadioRecommended = document.getElementById('compress-rec');
    const compressRadioExtreme = document.getElementById('compress-extreme');
    const compressRadioLow = document.getElementById('compress-low');
    // PDF to Image
    const selectImgFormat = document.getElementById('select-img-format');
    // Image to PDF
    const selectPageSize = document.getElementById('select-page-size');
    const selectImgOrientation = document.getElementById('select-img-orientation');
    const selectImgMargin = document.getElementById('select-img-margin');
    // Rotate
    const btnRotateAllCw = document.getElementById('btn-rotate-all-cw');
    const btnRotateAllCcw = document.getElementById('btn-rotate-all-ccw');
    // Watermark
    const watermarkTypeRadios = document.querySelectorAll('input[name="watermark-type"]');
    const watermarkTextInputs = document.getElementById('watermark-text-inputs');
    const watermarkImageInputs = document.getElementById('watermark-image-inputs');
    const watermarkText = document.getElementById('watermark-text');
    const watermarkFontSize = document.getElementById('watermark-font-size');
    const watermarkColor = document.getElementById('watermark-color');
    const watermarkImageFile = document.getElementById('watermark-image-file');
    const watermarkOpacity = document.getElementById('watermark-opacity');
    const watermarkRotation = document.getElementById('watermark-rotation');
    const watermarkLayout = document.getElementById('watermark-layout');
    // Page Numbers
    const pageNumFormat = document.getElementById('page-num-format');
    const pageNumPosition = document.getElementById('page-num-position');
    const pageNumStart = document.getElementById('page-num-start');
    const pageNumSize = document.getElementById('page-num-size');
    const pageNumSkipFirst = document.getElementById('page-num-skip-first');
    // Protect
    const protectPassword = document.getElementById('protect-password');
    const protectPasswordConfirm = document.getElementById('protect-password-confirm');
    const protectError = document.getElementById('protect-error');
    // Sign
    const signaturesList = document.getElementById('signatures-list');
    const btnCreateSignatureTrigger = document.getElementById('btn-create-signature-trigger');
    const signatureModal = document.getElementById('signature-modal');
    const btnCloseSigModal = document.getElementById('btn-close-sig-modal');
    const sigTabBtns = document.querySelectorAll('.sig-tab-btn');
    const sigTabDrawContent = document.getElementById('sig-tab-draw-content');
    const sigTabTypeContent = document.getElementById('sig-tab-type-content');
    const signatureCanvas = document.getElementById('signature-canvas');
    const btnClearSignature = document.getElementById('btn-clear-signature');
    const signatureTextInput = document.getElementById('signature-text-input');
    const fontPreviews = document.getElementById('font-previews');
    const btnCancelSigCreation = document.getElementById('btn-cancel-sig-creation');
    const btnSaveCreatedSignature = document.getElementById('btn-save-created-signature');
    const placementActions = document.getElementById('placement-actions');
    // Fill Form
    const formFieldsContainer = document.getElementById('form-fields-container');
    // OCR
    const ocrLanguage = document.getElementById('ocr-language');
    const checkboxForceOcr = document.getElementById('checkbox-force-ocr');

    // ----------------------------------------------------
    // NAVIGATION / SPA ROUTING
    // ----------------------------------------------------
    document.querySelectorAll('.tool-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const toolKey = btn.dataset.tool;
            setupToolWorkspace(toolKey);
        });
    });

    btnBackHome.addEventListener('click', () => {
        resetApp();
        workspaceView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        document.title = "Dividir PDF Online - Separar Páginas de PDF Grátis e Seguro";
    });

    function setupToolWorkspace(toolKey) {
        state.activeTool = toolKey;
        const meta = toolMeta[toolKey];
        workspaceTitle.textContent = meta.title;
        workspaceSubtitle.textContent = meta.subtitle;
        document.title = `${meta.title} - Ferramentas de PDF Online`;

        // Configure upload rules based on tool
        if (toolKey === 'merge') {
            fileInput.multiple = true;
            fileInput.accept = "application/pdf";
            uploadZoneIcon.setAttribute('data-lucide', 'layers');
            uploadZoneTitle.textContent = "Arraste e solte seus PDFs aqui";
            uploadZoneSubtitle.textContent = "ou clique para selecionar múltiplos arquivos";
            uploadZoneHint.textContent = "Selecione 2 ou mais arquivos PDF para mesclar";
        } else if (toolKey === 'img-to-pdf') {
            fileInput.multiple = true;
            fileInput.accept = "image/png, image/jpeg";
            uploadZoneIcon.setAttribute('data-lucide', 'image');
            uploadZoneTitle.textContent = "Arraste e solte suas imagens aqui";
            uploadZoneSubtitle.textContent = "ou clique para navegar nos seus arquivos";
            uploadZoneHint.textContent = "Suporta imagens JPG e PNG";
        } else {
            fileInput.multiple = false;
            fileInput.accept = "application/pdf";
            uploadZoneIcon.setAttribute('data-lucide', 'file-up');
            uploadZoneTitle.textContent = "Arraste e solte seu PDF aqui";
            uploadZoneSubtitle.textContent = "ou clique para navegar nos seus arquivos";
            uploadZoneHint.textContent = "Suporta arquivos PDF de qualquer tamanho";
        }

        // Action button configs
        btnProcessText.textContent = meta.title + " Agora";
        const targetBtn = document.querySelector(`.tool-card-btn[data-tool="${toolKey}"]`);
        const targetIcon = targetBtn ? targetBtn.querySelector('.tool-card-icon i').getAttribute('data-lucide') : 'scissors';
        btnProcessIcon.setAttribute('data-lucide', targetIcon);

        dashboardView.classList.add('hidden');
        workspaceView.classList.remove('hidden');
        
        refreshIcons();
    }

    // ----------------------------------------------------
    // UPLOAD OPERATIONS (Drag & Drop + Input File)
    // ----------------------------------------------------
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    uploadZone.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFiles(e.target.files);
        }
    });

    uploadZone.addEventListener('dragover', () => {
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        uploadZone.classList.remove('dragover');
        const dt = e.dataTransfer;
        if (dt.files.length > 0) {
            handleUploadedFiles(dt.files);
        }
    });

    btnReset.addEventListener('click', resetApp);
    btnStartOver.addEventListener('click', resetApp);

    // Add extra files for multi-file tools
    btnAddMoreFiles.addEventListener('click', () => {
        addMoreFilesInput.click();
    });

    addMoreFilesInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFiles(e.target.files, true);
        }
    });

    // ----------------------------------------------------
    // LOAD AND INITIALIZE FILES
    // ----------------------------------------------------
    async function handleUploadedFiles(fileList, appendMode = false) {
        try {
            showZone(processingZone);
            progressBarFill.style.width = '20%';
            processingStatusText.textContent = "Carregando arquivos selecionados...";

            const validFiles = Array.from(fileList).filter(file => {
                if (state.activeTool === 'img-to-pdf') {
                    return file.type.startsWith('image/') || file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg');
                } else {
                    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                }
            });

            if (validFiles.length === 0) {
                throw new Error("Por favor, selecione apenas arquivos compatíveis com o modo ativo.");
            }

            if (!appendMode) {
                state.files = [];
                state.deletedPages.clear();
                state.pageRotations = {};
            }

            progressBarFill.style.width = '40%';
            for (let file of validFiles) {
                const arrayBuffer = await readFileAsArrayBuffer(file);
                state.files.push({
                    fileObject: file,
                    name: file.name,
                    size: file.size,
                    arrayBuffer: arrayBuffer
                });
            }

            progressBarFill.style.width = '70%';
            // If it's a single file tool, parse it immediately with pdf-lib and pdf.js
            if (state.activeTool !== 'merge' && state.activeTool !== 'img-to-pdf') {
                const primaryFile = state.files[0];
                fileNameText.textContent = primaryFile.name;
                fileSizeText.textContent = formatBytes(primaryFile.size);

                // Load pdf-lib
                state.pdfDocLib = await PDFLib.PDFDocument.load(primaryFile.arrayBuffer, { ignoreEncryption: true });
                state.totalPages = state.pdfDocLib.getPageCount();
                totalPagesBadge.textContent = state.totalPages;

                // Load pdf.js for page previews
                state.pdfJsDoc = await pdfjsLib.getDocument({ data: primaryFile.arrayBuffer }).promise;
            } else {
                // Multi-file settings display
                fileNameText.textContent = `${state.files.length} arquivos selecionados`;
                fileSizeText.textContent = formatBytes(state.files.reduce((acc, f) => acc + f.size, 0));
            }

            progressBarFill.style.width = '100%';
            initializeEditorPanel();
            showZone(editorZone);
        } catch (e) {
            console.error(e);
            alert(e.message || "Erro ao carregar os arquivos.");
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
    // INITIALIZE EDITOR WORKSPACE
    // ----------------------------------------------------
    function initializeEditorPanel() {
        // Hide all configurations, then show the active one
        settingsGroups.forEach(group => group.classList.add('hidden'));
        const activeConfigGroup = document.getElementById(`settings-${state.activeTool}`);
        if (activeConfigGroup) activeConfigGroup.classList.remove('hidden');

        // Hide all left panel layouts, then show relevant one
        docSummaryCard.classList.add('hidden');
        multiFileListContainer.classList.add('hidden');
        pagesGridContainer.classList.add('hidden');
        canvasEditorContainer.classList.add('hidden');
        textOutputZone.classList.add('hidden');

        // Setup layouts based on tool
        if (state.activeTool === 'merge' || state.activeTool === 'img-to-pdf') {
            multiFileListContainer.classList.remove('hidden');
            renderMultiFileList();
        } else if (state.activeTool === 'rotate' || state.activeTool === 'organize') {
            pagesGridContainer.classList.remove('hidden');
            renderPageThumbnails();
        } else if (state.activeTool === 'sign') {
            canvasEditorContainer.classList.remove('hidden');
            setupSignatureEditor();
        } else if (state.activeTool === 'fill-form') {
            docSummaryCard.classList.remove('hidden');
            setupFormFiller();
        } else if (state.activeTool === 'split') {
            docSummaryCard.classList.remove('hidden');
            // Reset split fields
            inputFixedCount.value = 1;
            inputFixedCount.max = state.totalPages;
            inputCustomRanges.value = '';
            customRangesPreview.innerHTML = '';
            customRangesError.classList.add('hidden');
            updateFixedRangesSummary();
        } else {
            docSummaryCard.classList.remove('hidden');
        }

        // Initialize general tool-specific configs
        if (state.activeTool === 'watermark') {
            toggleWatermarkType();
        }

        btnProcess.disabled = false;
        refreshIcons();
    }

    // ----------------------------------------------------
    // LAYOUT 1: MULTI-FILE LIST (Merge / Img to PDF)
    // ----------------------------------------------------
    function renderMultiFileList() {
        fileListItems.innerHTML = '';
        multiFileCount.textContent = `${state.files.length} arquivo(s)`;

        state.files.forEach((fileObj, idx) => {
            const item = document.createElement('div');
            item.className = 'file-list-item';
            item.dataset.index = idx;

            const info = document.createElement('div');
            info.className = 'file-item-info';
            
            const isImage = state.activeTool === 'img-to-pdf';
            const iconName = isImage ? 'image' : 'file-text';
            info.innerHTML = `<i data-lucide="${iconName}" class="file-icon" style="width:18px; height:18px;"></i>
                              <div>
                                 <span class="file-item-name">${fileObj.name}</span>
                                 <span class="file-item-size">${formatBytes(fileObj.size)}</span>
                              </div>`;

            const btnRemove = document.createElement('button');
            btnRemove.className = 'btn-remove-file';
            btnRemove.innerHTML = '<i data-lucide="trash-2"></i>';
            btnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                state.files.splice(idx, 1);
                if (state.files.length === 0) {
                    resetApp();
                } else {
                    renderMultiFileList();
                }
            });

            item.appendChild(info);
            item.appendChild(btnRemove);
            fileListItems.appendChild(item);
        });

        // Initialize Sortable for list
        if (state.sortableFiles) state.sortableFiles.destroy();
        state.sortableFiles = new Sortable(fileListItems, {
            animation: 150,
            ghostClass: 'ghost',
            onEnd: () => {
                // Reorder state.files based on DOM children index
                const reorderedFiles = [];
                fileListItems.querySelectorAll('.file-list-item').forEach(item => {
                    const originalIdx = parseInt(item.dataset.index);
                    reorderedFiles.push(state.files[originalIdx]);
                });
                state.files = reorderedFiles;
                renderMultiFileList(); // update indexes in DOM
            }
        });

        refreshIcons();
    }

    // ----------------------------------------------------
    // LAYOUT 2: PAGES THUMBNAILS (Rotate & Organize)
    // ----------------------------------------------------
    async function renderPageThumbnails() {
        pagesGrid.innerHTML = '';
        
        for (let i = 1; i <= state.totalPages; i++) {
            if (state.deletedPages.has(i)) continue;

            const card = document.createElement('div');
            card.className = 'page-thumbnail-card';
            card.dataset.page = i;

            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'page-thumbnail-canvas-wrapper';
            
            const canvas = document.createElement('canvas');
            canvasWrapper.appendChild(canvas);
            card.appendChild(canvasWrapper);

            const numberLabel = document.createElement('span');
            numberLabel.className = 'page-number-label';
            numberLabel.textContent = `Pág. ${i}`;
            card.appendChild(numberLabel);

            // Thumbnail Actions
            const actionsOverlay = document.createElement('div');
            actionsOverlay.className = 'page-actions-overlay';

            if (state.activeTool === 'rotate') {
                const btnRotate = document.createElement('button');
                btnRotate.className = 'btn-page-action';
                btnRotate.innerHTML = '<i data-lucide="rotate-cw"></i>';
                btnRotate.addEventListener('click', (e) => {
                    e.stopPropagation();
                    rotateSinglePage(i, canvas);
                });
                actionsOverlay.appendChild(btnRotate);
            } else if (state.activeTool === 'organize') {
                const btnDelete = document.createElement('button');
                btnDelete.className = 'btn-page-action delete';
                btnDelete.innerHTML = '<i data-lucide="trash-2"></i>';
                btnDelete.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSinglePage(i);
                });
                actionsOverlay.appendChild(btnDelete);
            }

            card.appendChild(actionsOverlay);
            pagesGrid.appendChild(card);

            // Render async thumbnail
            renderPageToThumbnail(i, canvas);
        }

        // Initialize drag-to-reorder for Organize tool
        if (state.activeTool === 'organize') {
            if (state.sortablePages) state.sortablePages.destroy();
            state.sortablePages = new Sortable(pagesGrid, {
                animation: 150,
                ghostClass: 'ghost'
            });
        }

        refreshIcons();
    }

    async function renderPageToThumbnail(pageNum, canvas) {
        try {
            const page = await state.pdfJsDoc.getPage(pageNum);
            const rotation = state.pageRotations[pageNum] || 0;
            const viewport = page.getViewport({ scale: 0.25, rotation: rotation });
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
        } catch (e) {
            console.error("Erro ao renderizar thumbnail: ", e);
        }
    }

    function rotateSinglePage(pageNum, canvas) {
        const currentRotation = state.pageRotations[pageNum] || 0;
        state.pageRotations[pageNum] = (currentRotation + 90) % 360;
        renderPageToThumbnail(pageNum, canvas);
    }

    function deleteSinglePage(pageNum) {
        state.deletedPages.add(pageNum);
        renderPageThumbnails();
    }

    // Rotate all controls
    btnRotateAllCw.addEventListener('click', () => {
        for (let i = 1; i <= state.totalPages; i++) {
            const currentRotation = state.pageRotations[i] || 0;
            state.pageRotations[i] = (currentRotation + 90) % 360;
        }
        renderPageThumbnails();
    });

    btnRotateAllCcw.addEventListener('click', () => {
        for (let i = 1; i <= state.totalPages; i++) {
            const currentRotation = state.pageRotations[i] || 0;
            state.pageRotations[i] = (currentRotation + 270) % 360;
        }
        renderPageThumbnails();
    });

    // ----------------------------------------------------
    // LAYOUT 3: SIGN PDF (Visual placement + Canvas Pad)
    // ----------------------------------------------------
    function setupSignatureEditor() {
        state.currentEditPage = 1;
        currentEditPageSpan.textContent = state.currentEditPage;
        totalEditPagesSpan.textContent = state.totalPages;
        
        renderSignatureCanvasPage();
        renderSignatureList();
        initSignatureDrawingPad();

        draggableSignature.classList.add('hidden');
        placementActions.classList.add('hidden');
    }

    async function renderSignatureCanvasPage() {
        try {
            const pageNum = state.currentEditPage;
            const page = await state.pdfJsDoc.getPage(pageNum);
            // Render at standard scale that fits panel
            const viewport = page.getViewport({ scale: 1.0 });
            
            // Adjust canvas sizes to fit in the viewport smoothly
            const viewWidth = Math.min(viewport.width, 500);
            const ratio = viewWidth / viewport.width;
            
            editorPdfCanvas.width = viewWidth;
            editorPdfCanvas.height = viewport.height * ratio;

            const renderContext = {
                canvasContext: editorPdfCanvas.getContext('2d'),
                viewport: page.getViewport({ scale: ratio })
            };
            await page.render(renderContext).promise;
            
            // Save scaling details for final rendering coordinate conversions
            state.sigCanvasRatio = ratio;
            state.sigOriginalWidth = viewport.width;
            state.sigOriginalHeight = viewport.height;
        } catch (e) {
            console.error("Erro ao desenhar página do assinador: ", e);
        }
    }

    btnPrevPage.addEventListener('click', () => {
        if (state.currentEditPage > 1) {
            state.currentEditPage--;
            currentEditPageSpan.textContent = state.currentEditPage;
            renderSignatureCanvasPage();
        }
    });

    btnNextPage.addEventListener('click', () => {
        if (state.currentEditPage < state.totalPages) {
            state.currentEditPage++;
            currentEditPageSpan.textContent = state.currentEditPage;
            renderSignatureCanvasPage();
        }
    });

    // Drawing Pad Init
    function initSignatureDrawingPad() {
        if (state.signatureCanvasPad) return;
        
        signatureCanvas.width = signatureCanvas.parentElement.clientWidth || 390;
        signatureCanvas.height = 180;

        state.signatureCanvasPad = new SignaturePad(signatureCanvas, {
            backgroundColor: 'rgba(0, 0, 0, 0)',
            penColor: '#000000'
        });

        // Tabs Toggle
        sigTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                sigTabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const tab = btn.dataset.tab;
                if (tab === 'draw') {
                    sigTabDrawContent.classList.remove('hidden');
                    sigTabTypeContent.classList.add('hidden');
                } else {
                    sigTabDrawContent.classList.add('hidden');
                    sigTabTypeContent.classList.remove('hidden');
                    renderTypedSignaturePreviews();
                }
            });
        });

        // Clear canvas
        btnClearSignature.addEventListener('click', () => state.signatureCanvasPad.clear());

        // Typed signature previews handler
        signatureTextInput.addEventListener('input', renderTypedSignaturePreviews);
    }

    btnCreateSignatureTrigger.addEventListener('click', () => {
        signatureModal.classList.remove('hidden');
        if (state.signatureCanvasPad) {
            // Resize canvas to be correct on trigger
            const parentWidth = signatureCanvas.parentElement.clientWidth || 390;
            signatureCanvas.width = parentWidth;
            state.signatureCanvasPad.clear();
        }
    });

    btnCloseSigModal.addEventListener('click', hideSignatureModal);
    btnCancelSigCreation.addEventListener('click', hideSignatureModal);

    function hideSignatureModal() {
        signatureModal.classList.add('hidden');
    }

    function renderTypedSignaturePreviews() {
        const text = signatureTextInput.value.trim() || "Sua Assinatura";
        fontPreviews.innerHTML = '';
        
        const fonts = [
            { name: "Cursive Elegant", style: "font-family: 'Great Vibes', 'Caveat', cursive; font-size: 24px;" },
            { name: "Signature Style", style: "font-family: 'Alex Brush', 'Dancing Script', cursive; font-size: 26px;" },
            { name: "Simple Hand", style: "font-family: 'Reenie Beanie', cursive; font-size: 28px;" }
        ];

        fonts.forEach((font, idx) => {
            const card = document.createElement('div');
            card.className = 'signature-option-card';
            card.style = "background: #fff; border: 1px solid var(--card-border); color: #000; padding:12px; margin-bottom: 8px; border-radius: 4px; cursor: pointer;";
            card.innerHTML = `<span style="${font.style}">${text}</span>`;
            card.addEventListener('click', () => {
                // Convert text to image on dynamic canvas
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 400;
                tempCanvas.height = 150;
                const ctx = tempCanvas.getContext('2d');
                ctx.clearRect(0,0,400,150);
                ctx.fillStyle = '#000000';
                
                // We'll draw with a simple cursive font style
                ctx.font = idx === 0 ? "40px 'Brush Script MT', cursive" : idx === 1 ? "40px 'Great Vibes', cursive" : "36px 'Courier New', monospace";
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillText(text, 200, 75);
                
                const dataURL = tempCanvas.toDataURL('image/png');
                saveSignature(dataURL);
            });
            fontPreviews.appendChild(card);
        });
    }

    btnSaveCreatedSignature.addEventListener('click', () => {
        const activeTab = document.querySelector('.sig-tab-btn.active').dataset.tab;
        if (activeTab === 'draw') {
            if (state.signatureCanvasPad.isEmpty()) {
                alert("Por favor, desenhe uma assinatura primeiro.");
                return;
            }
            const dataURL = state.signatureCanvasPad.toDataURL('image/png');
            saveSignature(dataURL);
        }
    });

    function saveSignature(dataURL) {
        state.signatures.push(dataURL);
        renderSignatureList();
        hideSignatureModal();
    }

    function renderSignatureList() {
        signaturesList.innerHTML = '';
        if (state.signatures.length === 0) {
            signaturesList.innerHTML = '<span class="no-signatures" style="font-size: 0.815rem; color: var(--text-muted);">Nenhuma assinatura criada.</span>';
            return;
        }

        state.signatures.forEach((sigURL, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'signature-thumbnail';
            thumb.innerHTML = `<img src="${sigURL}" alt="Assinatura">`;
            thumb.addEventListener('click', () => selectSignatureForPlacement(sigURL));
            signaturesList.appendChild(thumb);
        });
    }

    function selectSignatureForPlacement(sigURL) {
        signatureImgPreview.src = sigURL;
        draggableSignature.classList.remove('hidden');
        placementActions.classList.remove('hidden');

        // Set default drag coordinates inside viewport
        state.draggedSigCoords = {
            x: 50,
            y: 50,
            width: 150,
            height: 60,
            page: state.currentEditPage
        };

        draggableSignature.style.left = state.draggedSigCoords.x + 'px';
        draggableSignature.style.top = state.draggedSigCoords.y + 'px';
        draggableSignature.style.width = state.draggedSigCoords.width + 'px';
        draggableSignature.style.height = state.draggedSigCoords.height + 'px';

        makeSignatureDraggable();
    }

    btnDeleteSig.addEventListener('click', () => {
        draggableSignature.classList.add('hidden');
        placementActions.classList.add('hidden');
        state.selectedSignature = null;
    });

    function makeSignatureDraggable() {
        const elm = draggableSignature;
        const container = canvasViewport;
        
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        elm.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            let top = elm.offsetTop - pos2;
            let left = elm.offsetLeft - pos1;

            // Constrain movement inside canvas viewport limits
            const limitWidth = container.clientWidth - elm.clientWidth;
            const limitHeight = container.clientHeight - elm.clientHeight;
            
            top = Math.max(0, Math.min(top, limitHeight));
            left = Math.max(0, Math.min(left, limitWidth));

            elm.style.top = top + 'px';
            elm.style.left = left + 'px';

            state.draggedSigCoords.x = left;
            state.draggedSigCoords.y = top;
            state.draggedSigCoords.page = state.currentEditPage;
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }

        // Add resize handles dynamically inside draggable block
        const resizeHandle = elm.querySelector('.sig-resize-handle');
        resizeHandle.onmousedown = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = elm.clientWidth;
            const startHeight = elm.clientHeight;
            const ratio = startWidth / startHeight;

            document.onmousemove = (ev) => {
                ev.preventDefault();
                const newWidth = startWidth + (ev.clientX - startX);
                const newHeight = newWidth / ratio;
                if (newWidth > 50 && newWidth < 300) {
                    elm.style.width = newWidth + 'px';
                    elm.style.height = newHeight + 'px';
                    state.draggedSigCoords.width = newWidth;
                    state.draggedSigCoords.height = newHeight;
                }
            };
            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    // ----------------------------------------------------
    // LAYOUT 4: FILL FORM (pdf-lib interative form parsing)
    // ----------------------------------------------------
    function setupFormFiller() {
        formFieldsContainer.innerHTML = '';
        state.formFields = [];
        
        try {
            const form = state.pdfDocLib.getForm();
            const fields = form.getFields();

            if (fields.length === 0) {
                formFieldsContainer.innerHTML = '<span class="no-fields" style="font-size: 0.815rem; color: var(--text-muted);">Nenhum campo interativo encontrado.</span>';
                return;
            }

            fields.forEach(field => {
                const name = field.getName();
                
                const row = document.createElement('div');
                row.className = 'form-field-row';
                
                const label = document.createElement('label');
                label.textContent = name;
                row.appendChild(label);
                
                let inputElement;
                if (field instanceof PDFLib.PDFTextField) {
                    inputElement = document.createElement('input');
                    inputElement.type = 'text';
                    inputElement.value = field.getText() || '';
                    inputElement.className = 'input-text';
                    inputElement.addEventListener('input', (e) => {
                        field.setText(e.target.value);
                    });
                } else if (field instanceof PDFLib.PDFCheckBox) {
                    inputElement = document.createElement('input');
                    inputElement.type = 'checkbox';
                    inputElement.checked = field.isChecked();
                    inputElement.addEventListener('change', (e) => {
                        if (e.target.checked) field.check();
                        else field.uncheck();
                    });
                } else if (field instanceof PDFLib.PDFDropdown) {
                    inputElement = document.createElement('select');
                    inputElement.className = 'input-select';
                    const options = field.getOptions();
                    options.forEach(opt => {
                        const o = document.createElement('option');
                        o.value = opt;
                        o.textContent = opt;
                        if (opt === field.getSelected()[0]) o.selected = true;
                        inputElement.appendChild(o);
                    });
                    inputElement.addEventListener('change', (e) => {
                        field.select(e.target.value);
                    });
                } else {
                    // Unknown or unsupported type
                    return;
                }

                row.appendChild(inputElement);
                formFieldsContainer.appendChild(row);
                state.formFields.push(field);
            });
        } catch (e) {
            console.error("Erro ao carregar campos de formulário: ", e);
            formFieldsContainer.innerHTML = '<span class="no-fields" style="font-size: 0.815rem; color: var(--accent-red);">Erro ao ler formulário.</span>';
        }
    }

    // ----------------------------------------------------
    // DYNAMIC WATERMARK VIEW TOGGLE
    // ----------------------------------------------------
    watermarkTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleWatermarkType);
    });

    function toggleWatermarkType() {
        const type = document.querySelector('input[name="watermark-type"]:checked').value;
        if (type === 'text') {
            watermarkTextInputs.classList.remove('hidden');
            watermarkImageInputs.classList.add('hidden');
        } else {
            watermarkTextInputs.classList.add('hidden');
            watermarkImageInputs.classList.remove('hidden');
        }
    }

    // ----------------------------------------------------
    // SPLIT INPUT HELPERS
    // ----------------------------------------------------
    const modeOptions = document.querySelectorAll('.mode-option');
    const settingsDetailSections = document.querySelectorAll('.settings-detail-section');
    
    modeOptions.forEach(option => {
        option.addEventListener('click', () => {
            modeOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');

            const radio = option.querySelector('input[type="radio"]');
            radio.checked = true;

            const modeValue = radio.value;
            settingsDetailSections.forEach(section => {
                if (section.id === `settings-${modeValue}`) {
                    section.classList.remove('hidden');
                    section.classList.add('active-settings');
                } else {
                    section.classList.add('hidden');
                    section.classList.remove('active-settings');
                }
            });
            validateSplitMode();
        });
    });

    inputCustomRanges.addEventListener('input', validateSplitRanges);
    
    function validateSplitRanges() {
        const value = inputCustomRanges.value.trim();
        customRangesPreview.innerHTML = '';
        
        if (value === '') {
            customRangesError.classList.add('hidden');
            btnProcess.disabled = false;
            return;
        }

        const isValidCharacters = /^[0-9\s,-]+$/.test(value);
        if (!isValidCharacters) {
            showSplitError('Caracteres inválidos detectados. Use apenas números, vírgulas e hifens.');
            return;
        }

        const parts = value.split(',');
        const ranges = [];
        let hasError = false;

        for (let part of parts) {
            part = part.trim();
            if (part === '') continue;

            if (part.includes('-')) {
                const rangeParts = part.split('-');
                if (rangeParts.length !== 2) {
                    hasError = true;
                    break;
                }
                const start = parseInt(rangeParts[0].trim(), 10);
                const end = parseInt(rangeParts[1].trim(), 10);

                if (isNaN(start) || isNaN(end) || start < 1 || end < 1 || start > state.totalPages || end > state.totalPages || start > end) {
                    hasError = true;
                    break;
                }

                const pages = [];
                for (let i = start; i <= end; i++) pages.push(i);
                ranges.push({ label: `${start}-${end}`, pages });
            } else {
                const pageNum = parseInt(part, 10);
                if (isNaN(pageNum) || pageNum < 1 || pageNum > state.totalPages) {
                    hasError = true;
                    break;
                }
                ranges.push({ label: `${pageNum}`, pages: [pageNum] });
            }
        }

        if (hasError) {
            showSplitError(`Intervalo inválido. Certifique-se de usar páginas entre 1 e ${state.totalPages}.`);
            return;
        }

        customRangesError.classList.add('hidden');
        btnProcess.disabled = false;

        state.parsedCustomRanges = ranges.map(r => r.pages);
        ranges.forEach(r => {
            const chip = document.createElement('span');
            chip.className = 'range-chip';
            chip.textContent = `Págs ${r.label} (${r.pages.length} pág${r.pages.length > 1 ? 's' : ''})`;
            customRangesPreview.appendChild(chip);
        });
    }

    function showSplitError(msg) {
        customRangesError.textContent = msg;
        customRangesError.classList.remove('hidden');
        btnProcess.disabled = true;
        state.parsedCustomRanges = [];
    }

    inputFixedCount.addEventListener('input', () => {
        let val = parseInt(inputFixedCount.value, 10);
        if (isNaN(val) || val < 1) inputFixedCount.value = 1;
        else if (val > state.totalPages) inputFixedCount.value = state.totalPages;
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
        if (val < state.totalPages) {
            inputFixedCount.value = val + 1;
            updateFixedRangesSummary();
        }
    });

    function updateFixedRangesSummary() {
        const x = parseInt(inputFixedCount.value, 10) || 1;
        const totalFiles = Math.ceil(state.totalPages / x);
        let text = '';
        if (totalFiles === 1) {
            text = `O documento todo será mantido em 1 único arquivo com ${state.totalPages} páginas.`;
        } else {
            const lastFilePages = state.totalPages % x === 0 ? x : state.totalPages % x;
            if (x === 1) {
                text = `O documento será dividido em ${totalFiles} arquivos de 1 página cada.`;
            } else {
                text = `O documento será dividido em ${totalFiles} arquivos: ${totalFiles - 1} de ${x} páginas e 1 final de ${lastFilePages} página(s).`;
            }
        }
        fixedRangesSummary.textContent = text;
    }

    function validateSplitMode() {
        const activeMode = document.querySelector('input[name="split-mode"]:checked').value;
        if (activeMode === 'custom-ranges') {
            validateSplitRanges();
        } else {
            btnProcess.disabled = false;
        }
    }

    // ----------------------------------------------------
    // MAIN PROCESSING CONTROLLER
    // ----------------------------------------------------
    btnProcess.addEventListener('click', async () => {
        btnProcess.disabled = true;
        showZone(processingZone);
        progressBarFill.style.width = '10%';
        processingStatusText.textContent = "Preparando o processamento do PDF...";

        try {
            await new Promise(resolve => setTimeout(resolve, 300)); // allow browser layout update
            
            switch (state.activeTool) {
                case 'split':
                    await runSplit();
                    break;
                case 'merge':
                    await runMerge();
                    break;
                case 'compress':
                    await runCompress();
                    break;
                case 'pdf-to-img':
                    await runPdfToImg();
                    break;
                case 'img-to-pdf':
                    await runImgToPdf();
                    break;
                case 'rotate':
                    await runRotate();
                    break;
                case 'organize':
                    await runOrganize();
                    break;
                case 'watermark':
                    await runWatermark();
                    break;
                case 'page-numbers':
                    await runPageNumbers();
                    break;
                case 'protect':
                    await runProtect();
                    break;
                case 'sign':
                    await runSign();
                    break;
                case 'fill-form':
                    await runFillForm();
                    break;
                case 'ocr':
                    await runOcr();
                    break;
                default:
                    throw new Error("Ação de processamento desconhecida.");
            }
        } catch (e) {
            console.error("Erro no processamento:", e);
            alert(`Ocorreu um erro no processamento: ${e.message || e}`);
            initializeEditorPanel();
            showZone(editorZone);
        }
    });

    // ----------------------------------------------------
    // WORKFLOW 1: SPLIT PDF
    // ----------------------------------------------------
    async function runSplit() {
        const activeMode = document.querySelector('input[name="split-mode"]:checked').value;
        let finalRanges = [];

        if (activeMode === 'extract-all') {
            for (let i = 1; i <= state.totalPages; i++) {
                finalRanges.push([i]);
            }
        } else if (activeMode === 'custom-ranges') {
            if (!state.parsedCustomRanges || state.parsedCustomRanges.length === 0) {
                throw new Error("Intervalo de páginas inválido.");
            }
            if (checkboxSeparatePages.checked) {
                finalRanges = state.parsedCustomRanges.flat().map(page => [page]);
            } else {
                finalRanges = state.parsedCustomRanges;
            }
        } else if (activeMode === 'fixed-ranges') {
            const x = parseInt(inputFixedCount.value, 10) || 1;
            let currRange = [];
            for (let i = 1; i <= state.totalPages; i++) {
                currRange.push(i);
                if (currRange.length === x || i === state.totalPages) {
                    finalRanges.push(currRange);
                    currRange = [];
                }
            }
        }

        const generatedFiles = [];
        const baseName = state.files[0].name.replace(/\.[^/.]+$/, "");

        for (let idx = 0; idx < finalRanges.length; idx++) {
            const pageList = finalRanges[idx];
            processingStatusText.textContent = `Processando arquivo ${idx + 1} de ${finalRanges.length}...`;
            
            const newPdf = await PDFLib.PDFDocument.create();
            const zeroIndexedPages = pageList.map(p => p - 1);
            const copiedPages = await newPdf.copyPages(state.pdfDocLib, zeroIndexedPages);
            
            copiedPages.forEach(p => newPdf.addPage(p));
            const newPdfBytes = await newPdf.save();
            const blob = new Blob([newPdfBytes], { type: 'application/pdf' });

            let outputName = `${baseName}_parte_${idx + 1}.pdf`;
            if (activeMode === 'custom-ranges') {
                const label = pageList.length === 1 ? `pag_${pageList[0]}` : `pags_${pageList[0]}_a_${pageList[pageList.length - 1]}`;
                outputName = `${baseName}_${label}.pdf`;
            } else if (activeMode === 'extract-all') {
                outputName = `${baseName}_pag_${pageList[0]}.pdf`;
            }

            generatedFiles.push({ blob, name: outputName });
            
            progressBarFill.style.width = Math.floor(((idx + 1) / finalRanges.length) * 80) + '%';
            await new Promise(r => setTimeout(r, 40));
        }

        await finalizeDownloadAndSuccess(generatedFiles, baseName);
    }

    // ----------------------------------------------------
    // WORKFLOW 2: MERGE PDF
    // ----------------------------------------------------
    async function runMerge() {
        if (state.files.length < 2) {
            throw new Error("Adicione pelo menos 2 arquivos PDF para mesclar.");
        }

        processingStatusText.textContent = "Combinando arquivos...";
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (let i = 0; i < state.files.length; i++) {
            const fileObj = state.files[i];
            processingStatusText.textContent = `Lendo e importando ${fileObj.name}...`;
            const doc = await PDFLib.PDFDocument.load(fileObj.arrayBuffer, { ignoreEncryption: true });
            
            const pageIndexes = Array.from({ length: doc.getPageCount() }, (_, index) => index);
            const copiedPages = await mergedPdf.copyPages(doc, pageIndexes);
            copiedPages.forEach(page => mergedPdf.addPage(page));

            progressBarFill.style.width = Math.floor(((i + 1) / state.files.length) * 90) + '%';
            await new Promise(r => setTimeout(r, 50));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const mergedBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        
        state.processedResult.blob = mergedBlob;
        state.processedResult.filename = "pdf_mesclado.pdf";
        
        progressBarFill.style.width = '100%';
        triggerDownload(mergedBlob, state.processedResult.filename);
        successMessage.textContent = 'O arquivo "pdf_mesclado.pdf" foi mesclado e baixado no seu navegador.';
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 3: COMPRESS PDF (Rasterize Compress)
    // ----------------------------------------------------
    async function runCompress() {
        processingStatusText.textContent = "Comprimindo arquivo PDF...";
        const level = document.querySelector('input[name="compress-level"]:checked').value;
        
        let dpi = 150;
        let quality = 0.7;
        if (level === 'extreme') {
            dpi = 90;
            quality = 0.45;
        } else if (level === 'low') {
            // Low compression: simple re-save with optimizations
            const compressedBytes = await state.pdfDocLib.save({ useObjectStreams: true });
            const compressBlob = new Blob([compressedBytes], { type: 'application/pdf' });
            
            state.processedResult.blob = compressBlob;
            state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_comprimido.pdf";
            triggerDownload(compressBlob, state.processedResult.filename);
            successMessage.textContent = 'O PDF foi comprimido e baixado com sucesso.';
            showZone(successZone);
            return;
        }

        // Reconstruction for Extreme/Recommended (Rasterize pages at lower DPI/JPEG Quality)
        const compressedPdf = await PDFLib.PDFDocument.create();
        
        for (let i = 1; i <= state.totalPages; i++) {
            processingStatusText.textContent = `Processando e otimizando página ${i} de ${state.totalPages}...`;
            
            const page = await state.pdfJsDoc.getPage(i);
            // Render viewport based on DPI (72 DPI is standard web scale, so scale is DPI/72)
            const scale = dpi / 72;
            const viewport = page.getViewport({ scale: scale });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            
            // Convert to JPEG blob at specified quality
            const imgDataURL = canvas.toDataURL('image/jpeg', quality);
            const imgBytes = await fetch(imgDataURL).then(res => res.arrayBuffer());
            
            const embeddedImg = await compressedPdf.embedJpg(imgBytes);
            const newPage = compressedPdf.addPage([viewport.width, viewport.height]);
            newPage.drawImage(embeddedImg, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height
            });

            progressBarFill.style.width = Math.floor((i / state.totalPages) * 85) + '%';
            await new Promise(r => setTimeout(r, 30));
        }

        const compressedBytes = await compressedPdf.save();
        const compressBlob = new Blob([compressedBytes], { type: 'application/pdf' });
        
        state.processedResult.blob = compressBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_comprimido.pdf";
        
        progressBarFill.style.width = '100%';
        triggerDownload(compressBlob, state.processedResult.filename);
        
        // Quality compression information info
        const pct = Math.round((1 - (compressBlob.size / state.files[0].size)) * 100);
        const savingsText = pct > 0 ? `Economia de aproximadamente ${pct}% no tamanho do arquivo!` : '';
        successMessage.textContent = `Arquivo comprimido gerado. ${savingsText}`;
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 4: PDF TO IMAGE
    // ----------------------------------------------------
    async function runPdfToImg() {
        const format = selectImgFormat.value;
        const dpi = parseInt(document.querySelector('input[name="img-dpi"]:checked').value) || 150;
        const scale = dpi / 72;

        const generatedImages = [];
        const baseName = state.files[0].name.replace(/\.[^/.]+$/, "");

        for (let i = 1; i <= state.totalPages; i++) {
            processingStatusText.textContent = `Renderizando página ${i} de ${state.totalPages}...`;
            
            const page = await state.pdfJsDoc.getPage(i);
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            
            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const imgDataURL = canvas.toDataURL(mimeType, 0.9);
            const imgBlob = await fetch(imgDataURL).then(res => res.blob());
            
            generatedImages.push({
                blob: imgBlob,
                name: `${baseName}_pagina_${i}.${format}`
            });

            progressBarFill.style.width = Math.floor((i / state.totalPages) * 85) + '%';
            await new Promise(r => setTimeout(r, 40));
        }

        // Finalize Zip or single file
        if (generatedImages.length === 1) {
            const single = generatedImages[0];
            state.processedResult.blob = single.blob;
            state.processedResult.filename = single.name;
            triggerDownload(single.blob, single.name);
            successMessage.textContent = `Imagem "${single.name}" baixada com sucesso.`;
        } else {
            processingStatusText.textContent = "Criando pacote compactado (ZIP)...";
            const zip = new JSZip();
            generatedImages.forEach(img => zip.file(img.name, img.blob));
            
            const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
                progressBarFill.style.width = 85 + Math.floor(metadata.percent * 0.15) + '%';
            });
            state.processedResult.blob = zipBlob;
            state.processedResult.filename = `${baseName}_imagens.zip`;
            
            triggerDownload(zipBlob, state.processedResult.filename);
            successMessage.textContent = `As ${generatedImages.length} imagens foram empacotadas no arquivo ZIP.`;
        }
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 5: IMAGE TO PDF
    // ----------------------------------------------------
    async function runImgToPdf() {
        if (state.files.length === 0) throw new Error("Selecione pelo menos uma imagem.");

        processingStatusText.textContent = "Gerando PDF...";
        const newPdf = await PDFLib.PDFDocument.create();

        const pageSizeVal = selectPageSize.value;
        const orientationVal = selectImgOrientation.value;
        const marginVal = selectImgMargin.value;

        // margins
        const margin = marginVal === 'large' ? 20 : marginVal === 'small' ? 10 : 0;

        for (let i = 0; i < state.files.length; i++) {
            const imgObj = state.files[i];
            processingStatusText.textContent = `Incorporando imagem ${imgObj.name}...`;

            // Detect image bytes and format
            const isPng = imgObj.name.toLowerCase().endsWith('.png');
            let embeddedImage;
            try {
                if (isPng) embeddedImage = await newPdf.embedPng(imgObj.arrayBuffer);
                else embeddedImage = await newPdf.embedJpg(imgObj.arrayBuffer);
            } catch (err) {
                // If it fails, try the alternative format
                try {
                    if (isPng) embeddedImage = await newPdf.embedJpg(imgObj.arrayBuffer);
                    else embeddedImage = await newPdf.embedPng(imgObj.arrayBuffer);
                } catch(e) {
                    throw new Error(`Falha ao ler formato de imagem do arquivo: ${imgObj.name}. Certifique-se de que é um JPG ou PNG válido.`);
                }
            }

            const imgWidth = embeddedImage.width;
            const imgHeight = embeddedImage.height;

            // Dimensions setup
            let pageWidth = 595.28; // A4 default
            let pageHeight = 841.89;

            if (pageSizeVal === 'letter') {
                pageWidth = 612;
                pageHeight = 792;
            } else if (pageSizeVal === 'fit') {
                pageWidth = imgWidth + (margin * 2);
                pageHeight = imgHeight + (margin * 2);
            }

            // orientation adjustment
            if (pageSizeVal !== 'fit') {
                let isLandscape = false;
                if (orientationVal === 'landscape') isLandscape = true;
                else if (orientationVal === 'auto' && imgWidth > imgHeight) isLandscape = true;

                if (isLandscape) {
                    const temp = pageWidth;
                    pageWidth = pageHeight;
                    pageHeight = temp;
                }
            }

            const page = newPdf.addPage([pageWidth, pageHeight]);

            // Draw image scaled within margins
            const maxWidth = pageWidth - (margin * 2);
            const maxHeight = pageHeight - (margin * 2);
            
            let drawWidth = imgWidth;
            let drawHeight = imgHeight;
            
            const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
            drawWidth = imgWidth * scale;
            drawHeight = imgHeight * scale;

            const drawX = margin + (maxWidth - drawWidth) / 2;
            const drawY = margin + (maxHeight - drawHeight) / 2;

            page.drawImage(embeddedImage, {
                x: drawX,
                y: drawY,
                width: drawWidth,
                height: drawHeight
            });

            progressBarFill.style.width = Math.floor(((i + 1) / state.files.length) * 90) + '%';
            await new Promise(r => setTimeout(r, 45));
        }

        const pdfBytes = await newPdf.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = "imagens_convertidas.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = `PDF gerado com sucesso contendo as ${state.files.length} imagens.`;
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 6: ROTATE PDF
    // ----------------------------------------------------
    async function runRotate() {
        processingStatusText.textContent = "Aplicando rotações...";
        const newPdf = await PDFLib.PDFDocument.create();
        
        const pageIndexes = Array.from({ length: state.totalPages }, (_, index) => index);
        const copiedPages = await newPdf.copyPages(state.pdfDocLib, pageIndexes);

        copiedPages.forEach((page, idx) => {
            const pageNum = idx + 1;
            const extraRotation = state.pageRotations[pageNum] || 0;
            if (extraRotation !== 0) {
                const currentRot = page.getRotation().angle;
                page.setRotation(PDFLib.degrees((currentRot + extraRotation) % 360));
            }
            newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_rotacionado.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = "As páginas foram rotacionadas e o PDF foi baixado.";
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 7: ORGANIZE / REMOVE PAGES
    // ----------------------------------------------------
    async function runOrganize() {
        processingStatusText.textContent = "Organizando e reordenando páginas...";
        
        // Read reordered page cards indexes from Sortable grid
        const cardElements = pagesGrid.querySelectorAll('.page-thumbnail-card');
        const finalPagesOrder = [];
        cardElements.forEach(card => {
            const pageNum = parseInt(card.dataset.page);
            if (!state.deletedPages.has(pageNum)) {
                finalPagesOrder.push(pageNum);
            }
        });

        if (finalPagesOrder.length === 0) {
            throw new Error("O documento final não pode ficar com 0 páginas.");
        }

        const newPdf = await PDFLib.PDFDocument.create();
        const zeroIndexedPages = finalPagesOrder.map(p => p - 1);
        const copiedPages = await newPdf.copyPages(state.pdfDocLib, zeroIndexedPages);

        copiedPages.forEach(p => newPdf.addPage(p));

        const pdfBytes = await newPdf.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_organizado.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = "As páginas do seu PDF foram reorganizadas.";
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 8: WATERMARK PDF
    // ----------------------------------------------------
    async function runWatermark() {
        processingStatusText.textContent = "Adicionando marca d'água...";
        const newPdf = await PDFLib.PDFDocument.create();
        
        const type = document.querySelector('input[name="watermark-type"]:checked').value;
        const opacityVal = parseFloat(watermarkOpacity.value) / 100;
        const rotationVal = parseInt(watermarkRotation.value) || 0;
        const layoutVal = watermarkLayout.value;

        // Embed original pages
        const pageIndexes = Array.from({ length: state.totalPages }, (_, index) => index);
        const copiedPages = await newPdf.copyPages(state.pdfDocLib, pageIndexes);

        // Standard Helvetica Font loader
        const font = await newPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

        let watermarkImageBytes = null;
        let embeddedWatermarkImage = null;
        if (type === 'image') {
            if (watermarkImageFile.files.length === 0) throw new Error("Selecione um arquivo de imagem para marca d'água.");
            watermarkImageBytes = await readFileAsArrayBuffer(watermarkImageFile.files[0]);
            const isPng = watermarkImageFile.files[0].name.toLowerCase().endsWith('.png');
            if (isPng) embeddedWatermarkImage = await newPdf.embedPng(watermarkImageBytes);
            else embeddedWatermarkImage = await newPdf.embedJpg(watermarkImageBytes);
        }

        for (let idx = 0; idx < copiedPages.length; idx++) {
            const page = copiedPages[idx];
            const { width, height } = page.getSize();

            // Prepare drawing rules
            if (type === 'text') {
                const textStr = watermarkText.value.trim() || "CONFIDENCIAL";
                const size = parseInt(watermarkFontSize.value) || 50;
                const colorHex = watermarkColor.value || "#ef4444";
                const colorRgb = hexToRgb(colorHex);

                const drawOptions = {
                    x: width / 2,
                    y: height / 2,
                    size: size,
                    font: font,
                    color: PDFLib.rgb(colorRgb.r/255, colorRgb.g/255, colorRgb.b/255),
                    opacity: opacityVal,
                    rotate: PDFLib.degrees(rotationVal),
                    rotateAnchor: PDFLib.RotateAnchor.Center
                };

                if (layoutVal === 'center') {
                    // Center positioning (text center)
                    const textWidth = font.widthOfTextAtSize(textStr, size);
                    drawOptions.x = (width - textWidth) / 2 + (textWidth / 2);
                    drawOptions.y = height / 2;
                    page.drawText(textStr, drawOptions);
                } else if (layoutVal === 'bottom-right') {
                    const textWidth = font.widthOfTextAtSize(textStr, size);
                    drawOptions.x = width - textWidth - 20;
                    drawOptions.y = 30;
                    drawOptions.rotate = PDFLib.degrees(0); // keep horizontal
                    page.drawText(textStr, drawOptions);
                } else if (layoutVal === 'top-left') {
                    drawOptions.x = 20;
                    drawOptions.y = height - 50;
                    drawOptions.rotate = PDFLib.degrees(0);
                    page.drawText(textStr, drawOptions);
                } else if (layoutVal === 'tile') {
                    // Draw in a grid / matrix style covering the page
                    drawOptions.size = Math.max(12, size * 0.5);
                    const stepX = 180;
                    const stepY = 180;
                    for (let x = 40; x < width; x += stepX) {
                        for (let y = 40; y < height; y += stepY) {
                            drawOptions.x = x;
                            drawOptions.y = y;
                            page.drawText(textStr, drawOptions);
                        }
                    }
                }
            } else {
                // Draw Image watermark
                const imgWidth = embeddedWatermarkImage.width;
                const imgHeight = embeddedWatermarkImage.height;
                let drawWidth = 200;
                let drawHeight = (imgHeight / imgWidth) * drawWidth;

                const drawOptions = {
                    x: (width - drawWidth) / 2,
                    y: (height - drawHeight) / 2,
                    width: drawWidth,
                    height: drawHeight,
                    opacity: opacityVal,
                    rotate: PDFLib.degrees(rotationVal)
                };

                if (layoutVal === 'center') {
                    page.drawImage(embeddedWatermarkImage, drawOptions);
                } else if (layoutVal === 'bottom-right') {
                    drawOptions.x = width - drawWidth - 20;
                    drawOptions.y = 20;
                    page.drawImage(embeddedWatermarkImage, drawOptions);
                } else if (layoutVal === 'top-left') {
                    drawOptions.x = 20;
                    drawOptions.y = height - drawHeight - 20;
                    page.drawImage(embeddedWatermarkImage, drawOptions);
                } else if (layoutVal === 'tile') {
                    drawOptions.width = 80;
                    drawOptions.height = (imgHeight / imgWidth) * 80;
                    const stepX = 150;
                    const stepY = 150;
                    for (let x = 20; x < width; x += stepX) {
                        for (let y = 20; y < height; y += stepY) {
                            drawOptions.x = x;
                            drawOptions.y = y;
                            page.drawImage(embeddedWatermarkImage, drawOptions);
                        }
                    }
                }
            }
            newPdf.addPage(page);
        }

        const pdfBytes = await newPdf.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_marca_dagua.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = "Marca d'água aplicada nas páginas com sucesso.";
        showZone(successZone);
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 0, b: 0 };
    }

    // ----------------------------------------------------
    // WORKFLOW 9: PAGE NUMBERS PDF
    // ----------------------------------------------------
    async function runPageNumbers() {
        processingStatusText.textContent = "Numerando páginas...";
        const newPdf = await PDFLib.PDFDocument.create();

        const format = pageNumFormat.value;
        const position = pageNumPosition.value;
        const startNum = parseInt(pageNumStart.value, 10) || 1;
        const fontSize = parseInt(pageNumSize.value, 10) || 10;
        const skipFirst = pageNumSkipFirst.checked;

        const pageIndexes = Array.from({ length: state.totalPages }, (_, index) => index);
        const copiedPages = await newPdf.copyPages(state.pdfDocLib, pageIndexes);

        const font = await newPdf.embedFont(PDFLib.StandardFonts.Helvetica);

        copiedPages.forEach((page, idx) => {
            const pageNum = idx + 1;
            const currentNumber = startNum + idx;

            if (!(skipFirst && pageNum === 1)) {
                const { width, height } = page.getSize();
                
                // Formulate label string
                let label = `${currentNumber}`;
                if (format === 'page-x') label = `Página ${currentNumber}`;
                else if (format === 'x-of-y') label = `${currentNumber} de ${state.totalPages}`;

                const textWidth = font.widthOfTextAtSize(label, fontSize);
                
                // Position coordinates
                let x = width / 2 - textWidth / 2;
                let y = 30;

                if (position === 'bottom-left') {
                    x = 30;
                } else if (position === 'bottom-right') {
                    x = width - textWidth - 30;
                } else if (position === 'top-center') {
                    x = width / 2 - textWidth / 2;
                    y = height - 40;
                } else if (position === 'top-right') {
                    x = width - textWidth - 30;
                    y = height - 40;
                }

                page.drawText(label, {
                    x: x,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: PDFLib.rgb(0.2, 0.2, 0.2) // dark grey
                });
            }
            newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_numerado.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = "Páginas numeradas com sucesso.";
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 10: PROTECT PDF
    // ----------------------------------------------------
    async function runProtect() {
        const pass = protectPassword.value;
        const passConfirm = protectPasswordConfirm.value;

        if (pass.length === 0) throw new Error("A senha não pode estar em branco.");
        if (pass !== passConfirm) {
            protectError.classList.remove('hidden');
            throw new Error("As senhas não coincidem.");
        }
        protectError.classList.add('hidden');

        processingStatusText.textContent = "Criptografando arquivo...";
        
        // Encrypt uses userPassword config inside save options
        const secureBytes = await state.pdfDocLib.save({
            userPassword: pass,
            ownerPassword: pass
        });

        const pdfBlob = new Blob([secureBytes], { type: 'application/pdf' });

        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_protegido.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = "PDF criptografado e protegido com sucesso.";
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 11: SIGN PDF
    // ----------------------------------------------------
    async function runSign() {
        if (!state.signatures || state.signatures.length === 0 || draggableSignature.classList.contains('hidden')) {
            throw new Error("Crie e posicione uma assinatura na página.");
        }

        processingStatusText.textContent = "Fundindo assinatura no PDF...";
        const newPdf = await PDFLib.PDFDocument.create();

        // Get signature image bytes
        const sigBase64 = signatureImgPreview.src;
        const sigBytes = await fetch(sigBase64).then(res => res.arrayBuffer());
        
        // Copy original pages
        const pageIndexes = Array.from({ length: state.totalPages }, (_, index) => index);
        const copiedPages = await newPdf.copyPages(state.pdfDocLib, pageIndexes);

        // Embed signature image
        const embeddedSig = await newPdf.embedPng(sigBytes);

        // Get signature layout values
        const editPageNum = state.draggedSigCoords.page;
        const rx = state.draggedSigCoords.x;
        const ry = state.draggedSigCoords.y;
        const rwidth = state.draggedSigCoords.width;
        const rheight = state.draggedSigCoords.height;

        // Convert UI scaled pixels to PDF points
        const page = copiedPages[editPageNum - 1];
        const { width: pWidth, height: pHeight } = page.getSize();
        
        const scaleX = pWidth / (editorPdfCanvas.width);
        const scaleY = pHeight / (editorPdfCanvas.height);
        
        const sigWidthPoints = rwidth * scaleX;
        const sigHeightPoints = rheight * scaleY;
        const sigXPoints = rx * scaleX;
        
        // PDF coordinates are from bottom-left, HTML is from top-left
        const sigYPoints = pHeight - (ry * scaleY) - sigHeightPoints;

        copiedPages.forEach((page, idx) => {
            if (idx === (editPageNum - 1)) {
                page.drawImage(embeddedSig, {
                    x: sigXPoints,
                    y: sigYPoints,
                    width: sigWidthPoints,
                    height: sigHeightPoints
                });
            }
            newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_assinado.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = "Assinatura aplicada visualmente.";
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 12: FILL FORM PDF
    // ----------------------------------------------------
    async function runFillForm() {
        processingStatusText.textContent = "Preenchendo formulário...";
        
        const pdfBytes = await state.pdfDocLib.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        state.processedResult.blob = pdfBlob;
        state.processedResult.filename = state.files[0].name.replace(/\.[^/.]+$/, "") + "_preenchido.pdf";

        triggerDownload(pdfBlob, state.processedResult.filename);
        successMessage.textContent = "Campos salvos com sucesso no PDF.";
        showZone(successZone);
    }

    // ----------------------------------------------------
    // WORKFLOW 13: OCR / TEXT EXTRACTION
    // ----------------------------------------------------
    async function runOcr() {
        processingStatusText.textContent = "Extraindo textos...";
        const forceOcr = checkboxForceOcr.checked;
        const lang = ocrLanguage.value;
        
        let extractedText = "";

        if (!forceOcr) {
            // First attempt to extract native text content using PDF.js
            try {
                for (let i = 1; i <= state.totalPages; i++) {
                    processingStatusText.textContent = `Lendo página ${i} de ${state.totalPages}...`;
                    const page = await state.pdfJsDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    extractedText += `--- Página ${i} ---\n${pageText}\n\n`;
                    progressBarFill.style.width = Math.floor((i / state.totalPages) * 85) + '%';
                }
            } catch (err) {
                console.warn("Falha na extração de texto nativo. Rodando OCR...", err);
            }
        }

        // If no text found or OCR forced, run Tesseract.js
        const hasNoText = extractedText.replace(/--- Página \d+ ---|\s/g, "") === "";
        if (forceOcr || hasNoText) {
            extractedText = "";
            processingStatusText.textContent = "Processando OCR (pode levar alguns minutos)...";
            
            // Check Tesseract availability
            if (typeof Tesseract === 'undefined') {
                throw new Error("A biblioteca Tesseract.js de OCR não pôde ser carregada.");
            }

            const worker = await Tesseract.createWorker(lang);
            
            for (let i = 1; i <= state.totalPages; i++) {
                processingStatusText.textContent = `Rodando OCR na página ${i} de ${state.totalPages}...`;
                const page = await state.pdfJsDoc.getPage(i);
                
                // Render page to canvas at high DPI for Tesseract
                const scale = 2.0; 
                const viewport = page.getViewport({ scale: scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                // OCR processing
                const { data: { text } } = await worker.recognize(canvas);
                extractedText += `--- Página ${i} (OCR) ---\n${text}\n\n`;
                
                progressBarFill.style.width = Math.floor((i / state.totalPages) * 85) + '%';
            }
            await worker.terminate();
        }

        progressBarFill.style.width = '100%';
        
        extractedTextArea.value = extractedText;
        textOutputZone.classList.remove('hidden');
        
        successMessage.textContent = "Texto extraído com sucesso! Veja a caixa de resultado abaixo.";
        showZone(successZone);
    }

    btnCopyExtractedText.addEventListener('click', () => {
        extractedTextArea.select();
        document.execCommand('copy');
        alert("Texto copiado para a área de transferência!");
    });

    // ----------------------------------------------------
    // COMMON UTILITY ACTIONS / DOWNLOAD SUCCESS
    // ----------------------------------------------------
    async function finalizeDownloadAndSuccess(filesList, baseName) {
        if (filesList.length === 1) {
            const file = filesList[0];
            state.processedResult.blob = file.blob;
            state.processedResult.filename = file.name;
            triggerDownload(file.blob, file.name);
            successMessage.textContent = `O arquivo "${file.name}" foi baixado no seu navegador.`;
        } else {
            processingStatusText.textContent = "Empacotando no arquivo ZIP...";
            const zip = new JSZip();
            filesList.forEach(f => zip.file(f.name, f.blob));
            
            const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
                progressBarFill.style.width = 80 + Math.floor(metadata.percent * 0.2) + '%';
            });

            state.processedResult.blob = zipBlob;
            state.processedResult.filename = `${baseName}_dividido.zip`;
            triggerDownload(zipBlob, state.processedResult.filename);
            successMessage.textContent = `O arquivo ZIP com as ${filesList.length} partes foi baixado.`;
        }
        showZone(successZone);
    }

    btnDownloadAgain.addEventListener('click', () => {
        if (state.processedResult.blob && state.processedResult.filename) {
            triggerDownload(state.processedResult.blob, state.processedResult.filename);
        }
    });

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 150);
    }

    function showZone(zone) {
        [uploadZone, editorZone, processingZone, successZone].forEach(z => {
            if (z) z.classList.add('hidden');
        });
        zone.classList.remove('hidden');
    }

    function resetApp() {
        state.files = [];
        state.totalPages = 0;
        state.pdfDocLib = null;
        state.pdfJsDoc = null;
        state.pageRotations = {};
        state.deletedPages.clear();
        state.processedResult = { blob: null, filename: '' };
        
        fileInput.value = '';
        addMoreFilesInput.value = '';
        watermarkImageFile.value = '';
        protectPassword.value = '';
        protectPasswordConfirm.value = '';

        if (state.sortablePages) {
            state.sortablePages.destroy();
            state.sortablePages = null;
        }
        if (state.sortableFiles) {
            state.sortableFiles.destroy();
            state.sortableFiles = null;
        }

        // Hide floating overlays
        draggableSignature.classList.add('hidden');
        placementActions.classList.add('hidden');
        textOutputZone.classList.add('hidden');

        initializeEditorPanel();
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
