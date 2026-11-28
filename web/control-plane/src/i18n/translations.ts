import type { Locale } from '../types/protocol';

export interface Translations {
  brandSubtitle: string;
  scenariosHeading: string;
  controlsHeading: string;
  runtimeHeading: string;
  play: string;
  pause: string;
  step: string;
  reset: string;
  instant: string;
  speed: string;
  finopsCost: string;
  finopsTokens: string;
  finopsLatency: string;
  finopsGroundedness: string;
  graphTitle: string;
  graphHint: string;
  timeTravelTitle: string;
  branchDiffTitle: string;
  stateInspectorTitle: string;
  forkReplayBtn: string;
  applyOptimalPreset: string;
  wireTitle: string;
  hitlTitle: string;
  approveRollback: string;
  modifyCanaryApprove: string;
  rejectEscalate: string;
  canaryLabel: string;
  nodeInspectorTitle: string;
  cmdPlaceholder: string;
  browserEngine: string;
  pythonCluster: string;
  byokMode: string;
  clusterOffline: string;
  clusterOnline: string;
  verdictHeading: string;
  forkCalloutTitle: string;
  forkCalloutBody: string;
  forkCalloutBtn: string;
  // v2.0 VIP PRO additions
  exportAuditBtn: string;
  exportAuditSaved: string;
  redTeamTitle: string;
  redTeamSubtitle: string;
  redTeamSimulateBtn: string;
  redTeamBenignBtn: string;
  redTeamClearBtn: string;
  finopsSimTitle: string;
  finopsSimSubtitle: string;
  finopsFrontierLabel: string;
  finopsCascadeLabel: string;
  finopsScaleLabel: string;
  finopsLaunchForkBtn: string;
  keyboardHint: string;
  // v3.0 ENTERPRISE SUPER VIP PRO additions
  dagBuilderTitle: string;
  dagBuilderSubtitle: string;
  dagRunTraceBtn: string;
  dagStepBtn: string;
  dagResetBtn: string;
  dagAddNodeLabel: string;
  dagInspectorHeading: string;
  forkAltModelLabel: string;
  forkAltPromptLabel: string;
  forkAltReplayBtn: string;
  finopsRouterTitle: string;
  finopsRouterSubtitle: string;
  finopsVolumeLabel: string;
  finopsCacheHitLabel: string;
  finopsPolicyQuality: string;
  finopsPolicyBalanced: string;
  finopsPolicyCost: string;
  owaspSuiteTitle: string;
  owaspSuiteSubtitle: string;
  owaspRunAllBtn: string;
  owaspExportJsonBtn: string;
  owaspExportMdBtn: string;
  licenseBtnLabel: string;
  licenseModalTitle: string;
  licenseModalSubtitle: string;
  // v4.0 Prompt Firewall, Token Budget Circuit Breaker & Waterfall Replay
  firewallLabTitle: string;
  firewallLabSubtitle: string;
  firewallScannerHeading: string;
  budgetBreakerHeading: string;
  waterfallReplayTitle: string;
  waterfallReplaySubtitle: string;
  // v5.0 Breathable Studio Workspace & Multi-Model Pareto Routing Arena
  tabOrchestrator: string;
  tabFirewall: string;
  tabRoutingArena: string;
  tabAuditOtlp: string;
  themeDaylight: string;
  themeObsidian: string;
  arenaTitle: string;
  arenaSubtitle: string;
  arenaVolumeLabel: string;
  arenaQualityFloorLabel: string;
  arenaLatencyBudgetLabel: string;
  arenaCacheHitLabel: string;
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    brandSubtitle: 'MULTI-AGENT CONTROL PLANE // MCP × A2A × AG-UI × OTEL',
    scenariosHeading: 'ENTERPRISE SCENARIOS',
    controlsHeading: 'EXECUTION TRANSPORT',
    runtimeHeading: 'EXECUTION RUNTIME',
    play: 'Auto-Play',
    pause: 'Pause',
    step: 'Step',
    reset: 'Reset',
    instant: 'Instant',
    speed: 'SPEED',
    finopsCost: 'RUN COST',
    finopsTokens: 'TOKENS',
    finopsLatency: 'LATENCY',
    finopsGroundedness: 'GROUNDEDNESS',
    graphTitle: 'INTERACTIVE MULTI-AGENT VISUAL DEBUGGER',
    graphHint: 'Drag nodes to rewire · Click any wire to inject faults · Toggle BP to pause & fork',
    timeTravelTitle: 'TIME-TRAVEL CHECKPOINTER & DAG',
    branchDiffTitle: 'BRANCH DIFF (A vs B)',
    stateInspectorTitle: 'CHECKPOINT STATE JSON',
    forkReplayBtn: 'Fork & Replay Branch',
    applyOptimalPreset: 'Apply Optimal Preset (top_k=8, rerank=true)',
    wireTitle: '3-PROTOCOL WIRE INSPECTOR & OTEL WATERFALL',
    hitlTitle: 'HITL INTERRUPT CHECKPOINT — OPERATOR AUTHORIZATION REQUIRED',
    approveRollback: 'Approve Rollback (100%)',
    modifyCanaryApprove: 'Modify Canary & Approve',
    rejectEscalate: 'Reject & Escalate',
    canaryLabel: 'Canary Traffic Slice',
    nodeInspectorTitle: 'NODE STATE, TOKENS & CONTRACT INSPECTOR',
    cmdPlaceholder: 'Type a command, scenario, protocol tab, or action...',
    browserEngine: 'Browser Protocol Engine',
    pythonCluster: 'Python Cluster :8090',
    byokMode: 'BYOK Live LLM',
    clusterOffline: 'Offline (Browser Engine Active)',
    clusterOnline: 'Connected :8090',
    verdictHeading: 'GROUNDED SYNTHESIZER VERDICT & AG-UI WIDGET',
    forkCalloutTitle: 'LOW GROUNDEDNESS DETECTED (0.61) — TIME-TRAVEL RECOVERY READY',
    forkCalloutBody:
      'Step CP-02 retrieved 24 unranked chunks including archived 2022 drafts. Jump to CP-02, set top_k: 8, rerank: true, strict_grounding: true, and fork Branch B to recover 0.99 groundedness at 42%+ lower token cost.',
    forkCalloutBtn: 'Load CP-02 Optimal Fork Preset',
    exportAuditBtn: 'Export Audit',
    exportAuditSaved: 'Audit Saved',
    redTeamTitle: 'RED-TEAM GUARDRAIL TESTER',
    redTeamSubtitle: 'Adversarial risk classifier (0.00-1.00) · Live Node 04 quarantine & 04 -> 01 cyclic replan',
    redTeamSimulateBtn: 'Simulate Attack',
    redTeamBenignBtn: 'Test Clean Payload',
    redTeamClearBtn: 'Clear Graph Alert',
    finopsSimTitle: 'FINOPS COST & GROUNDEDNESS A/B SIMULATOR',
    finopsSimSubtitle: 'Main vs Time-Travel Fork · Tiered Cascade Router (-52.2%) & Monthly Fleet Projection',
    finopsFrontierLabel: 'Frontier Only',
    finopsCascadeLabel: 'Tiered Cascade Router (-52.2%)',
    finopsScaleLabel: 'MONTHLY AGENT VOLUME',
    finopsLaunchForkBtn: 'Run SCN-D Live Fork',
    keyboardHint: 'KEYS: [SPACE] PLAY/PAUSE · [N] STEP · [R] RESET',
    dagBuilderTitle: 'CUSTOM MULTI-AGENT WORKFLOW DAG BUILDER & NODE INSPECTOR',
    dagBuilderSubtitle: 'Add, remove & reorder 7 enterprise roles · Edit model, max tokens, temp & retries · Live photonic trace',
    dagRunTraceBtn: 'Execute Live Trace',
    dagStepBtn: 'Step Node',
    dagResetBtn: 'Reset',
    dagAddNodeLabel: 'ADD AGENT NODE:',
    dagInspectorHeading: 'NODE CONFIGURATION INSPECTOR',
    forkAltModelLabel: 'ALTERNATE MODEL',
    forkAltPromptLabel: 'ALTERNATE PROMPT / SYSTEM DIRECTIVE',
    forkAltReplayBtn: 'Fork & Replay with Alternate Model / Prompt',
    finopsRouterTitle: 'MULTI-MODEL FINOPS COST / LATENCY ROUTER MATRIX',
    finopsRouterSubtitle: 'Gemini 2.5 Pro · Claude 3.7 · GPT-4o · Local vLLM Qwen-72B · Interactive Cost-vs-Quality Pareto',
    finopsVolumeLabel: 'MONTHLY REQUEST VOLUME',
    finopsCacheHitLabel: 'SEMANTIC + KV CACHE HIT RATE',
    finopsPolicyQuality: 'Quality First',
    finopsPolicyBalanced: 'Balanced Hybrid',
    finopsPolicyCost: 'Cost Optimized',
    owaspSuiteTitle: 'OWASP LLM TOP-10 RED-TEAM ADVERSARIAL SUITE',
    owaspSuiteSubtitle: '10 live adversarial probes · Confidence score · Guardrail latency (ms) · JSON / Markdown Audit Export',
    owaspRunAllBtn: 'Run All 10 Probes',
    owaspExportJsonBtn: 'JSON Report',
    owaspExportMdBtn: 'Markdown Report',
    licenseBtnLabel: 'License · 19.9M',
    licenseModalTitle: 'VERDICT GRAPH v6.0 — ENTERPRISE LICENSE & VIETQR',
    licenseModalSubtitle: 'Commercial Source Code Rights · MBBank Direct VietQR Settlement · TVT Studio Flagship #3',
    firewallLabTitle: 'PROMPT FIREWALL (OWASP LLM01-LLM10) & LIVE TOKEN BUDGET CIRCUIT BREAKER',
    firewallLabSubtitle: 'Real-time multi-vector prompt inspection with exact pattern spans · HARD_STOP vs Frontier-to-Flash auto-downgrade',
    firewallScannerHeading: 'MULTI-VECTOR OWASP PROMPT FIREWALL',
    budgetBreakerHeading: 'TOKEN / USD BUDGET CIRCUIT BREAKER',
    waterfallReplayTitle: 'INTERACTIVE DAG LATENCY & COST WATERFALL REPLAY',
    waterfallReplaySubtitle: 'Step-by-step animated multi-branch replay tracking cumulative P95 latency & USD spend per agent node',
    tabOrchestrator: 'Orchestrator DAG',
    tabFirewall: 'OWASP Firewall',
    tabRoutingArena: 'Model Routing Arena',
    tabAuditOtlp: 'Audit & OTLP',
    themeDaylight: 'Daylight',
    themeObsidian: 'Obsidian',
    arenaTitle: 'MULTI-MODEL FINOPS ROUTING & PARETO FRONTIER ARENA',
    arenaSubtitle: '6 frontier & open-weight LLM profiles · Deterministic cascading router policy · Live Cost-vs-Quality Pareto frontier',
    arenaVolumeLabel: 'Monthly Request Volume',
    arenaQualityFloorLabel: 'Groundedness Quality Floor',
    arenaLatencyBudgetLabel: 'P95 Latency Budget',
    arenaCacheHitLabel: 'Prompt Caching Hit Rate',
  },
  vi: {
    brandSubtitle: 'TRUNG TÂM ĐIỀU KHIỂN ĐA TÁC TỬ // MCP × A2A × AG-UI × OTEL',
    scenariosHeading: 'KỊCH BẢN DOANH NGHIỆP',
    controlsHeading: 'ĐIỀU KHIỂN THỰC THI',
    runtimeHeading: 'MÔI TRƯỜNG CHẠY',
    play: 'Tự chạy',
    pause: 'Tạm dừng',
    step: 'Từng bước',
    reset: 'Đặt lại',
    instant: 'Tức thì',
    speed: 'TỐC ĐỘ',
    finopsCost: 'CHI PHÍ',
    finopsTokens: 'TOKEN',
    finopsLatency: 'ĐỘ TRỄ',
    finopsGroundedness: 'ĐỘ XÁC THỰC',
    graphTitle: 'TRÌNH GỠ LỖI ĐA TÁC TỬ TƯƠNG TÁC TRỰC QUAN',
    graphHint: 'Kéo thả node để nối dây trực tiếp · Nhấp dây để tiêm lỗi · Bật BP để tạm dừng & tách nhánh',
    timeTravelTitle: 'CHECKPOINT DU HÀNH THỜI GIAN & DAG',
    branchDiffTitle: 'SO SÁNH NHÁNH (A vs B)',
    stateInspectorTitle: 'TRÌNH CHỈNH SỬA STATE JSON',
    forkReplayBtn: 'Tách Nhánh & Chạy Lại',
    applyOptimalPreset: 'Áp cấu hình tối ưu (top_k=8, rerank=true)',
    wireTitle: 'SOI GÓI TIN 3 GIAO THỨC & BIỂU ĐỒ OTEL GENAI',
    hitlTitle: 'ĐIỂM NGẮT HITL — YÊU CẦU PHÊ DUYỆT TỪ KỸ SƯ VẬN HÀNH',
    approveRollback: 'Duyệt Rollback (100%)',
    modifyCanaryApprove: 'Đổi Canary & Duyệt',
    rejectEscalate: 'Từ chối & Báo L3',
    canaryLabel: 'Tỷ lệ lưu lượng Canary',
    nodeInspectorTitle: 'SOI TRẠNG THÁI, TOKEN & HỢP ĐỒNG GIAO THỨC',
    cmdPlaceholder: 'Nhập lệnh nhanh, kịch bản, tab giao thức hoặc thao tác...',
    browserEngine: 'Engine Giao Thức Trình Duyệt',
    pythonCluster: 'Cụm Python :8090',
    byokMode: 'BYOK LLM Trực Tiếp',
    clusterOffline: 'Chưa bật :8090 (Đang chạy Engine Trình duyệt)',
    clusterOnline: 'Đã kết nối :8090',
    verdictHeading: 'KẾT LUẬN TỔNG HỢP CÓ TRÍCH DẪN & WIDGET AG-UI',
    forkCalloutTitle: 'PHÁT HIỆN ĐỘ XÁC THỰC THẤP (0.61) — SẴN SÀNG TÁCH NHÁNH KHÔI PHỤC',
    forkCalloutBody:
      'Bước CP-02 truy xuất 24 đoạn không xếp hạng chứa tài liệu cũ 2022. Chọn CP-02, đặt top_k: 8, rerank: true, strict_grounding: true và bấm Tách Nhánh & Chạy Lại để đạt 0.99 độ xác thực và giảm >42% chi phí token.',
    forkCalloutBtn: 'Nạp cấu hình tối ưu tại CP-02',
    exportAuditBtn: 'Xuất Audit',
    exportAuditSaved: 'Đã Xuất Audit',
    redTeamTitle: 'HỘP CÁT KIỂM THỬ RED-TEAM GUARDRAIL',
    redTeamSubtitle: 'Bộ phân loại rủi ro đa luật (0.00-1.00) · Cách ly Node 04 & vòng lặp 04 -> 01',
    redTeamSimulateBtn: 'Mô Phỏng Tấn Công',
    redTeamBenignBtn: 'Thử Payload Sạch',
    redTeamClearBtn: 'Tắt Cảnh Báo Đồ Thị',
    finopsSimTitle: 'MÔ PHỎNG FINOPS CHI PHÍ & ĐỘ XÁC THỰC A/B',
    finopsSimSubtitle: 'So sánh Main vs Fork · Định tuyến Phân tầng (-52.2%) & Dự báo Quy mô Tháng',
    finopsFrontierLabel: 'Chỉ Model Frontier',
    finopsCascadeLabel: 'Định Tuyến Phân Tầng (-52.2%)',
    finopsScaleLabel: 'SẢN LƯỢNG CHẠY HÀNG THÁNG',
    finopsLaunchForkBtn: 'Chạy Fork Thực Tế SCN-D',
    keyboardHint: 'PHÍM TẮT: [SPACE] CHẠY/DỪNG · [N] BƯỚC · [R] ĐẶT LẠI',
    dagBuilderTitle: 'TRÌNH THIẾT KẾ DAG ĐA TÁC TỬ & SOI CẤU HÌNH NODE',
    dagBuilderSubtitle: 'Thêm, xóa & sắp xếp 7 vai trò tác tử · Sửa model, max tokens, temp & retry · Chạy trace trực tiếp',
    dagRunTraceBtn: 'Chạy Trace Trực Tiếp',
    dagStepBtn: 'Bước Kế',
    dagResetBtn: 'Đặt Lại',
    dagAddNodeLabel: 'THÊM NODE TÁC TỬ:',
    dagInspectorHeading: 'CẤU HÌNH CHI TIẾT NODE',
    forkAltModelLabel: 'MODEL THAY THẾ',
    forkAltPromptLabel: 'CHỈ THỊ PROMPT / HỆ THỐNG THAY THẾ',
    forkAltReplayBtn: 'Tách Nhánh & Chạy Lại Với Model / Prompt Mới',
    finopsRouterTitle: 'MA TRẬN ĐỊNH TUYẾN FINOPS ĐA MODEL CHI PHÍ / ĐỘ TRỄ',
    finopsRouterSubtitle: 'Gemini 2.5 Pro · Claude 3.7 · GPT-4o · Local vLLM Qwen-72B · Biểu đồ Pareto Chi phí - Chất lượng',
    finopsVolumeLabel: 'LƯU LƯỢNG REQUEST HÀNG THÁNG',
    finopsCacheHitLabel: 'TỶ LỆ TRÚNG CACHE NGỮ NGHĨA + KV',
    finopsPolicyQuality: 'Ưu Tiên Chất Lượng',
    finopsPolicyBalanced: 'Cân Bằng Hybrid',
    finopsPolicyCost: 'Tối Ưu Chi Phí',
    owaspSuiteTitle: 'BỘ KIỂM THỬ RED-TEAM OWASP LLM TOP-10',
    owaspSuiteSubtitle: '10 mũi tấn công đối kháng · Điểm tin cậy · Độ trễ Guardrail (ms) · Xuất Báo Cáo JSON / Markdown',
    owaspRunAllBtn: 'Chạy Cả 10 Probe',
    owaspExportJsonBtn: 'Xuất JSON',
    owaspExportMdBtn: 'Xuất Markdown',
    licenseBtnLabel: 'Bản Quyền · 19.9M',
    licenseModalTitle: 'VERDICT GRAPH v6.0 — BÁO GIÁ DOANH NGHIỆP & VIETQR',
    licenseModalSubtitle: 'Bản Quyền Mã Nguồn Thương Mại · Thanh Toán VietQR MBBank · Flagship #3 TVT Studio',
    firewallLabTitle: 'TƯỜNG LỬA PROMPT (OWASP LLM01-LLM10) & BỘ NGẮT MẠCH NGÂN SÁCH TOKEN',
    firewallLabSubtitle: 'Quét prompt đa vector thời gian thực, tô sáng đoạn rủi ro · HARD_STOP hoặc tự hạ tầng Frontier sang Flash',
    firewallScannerHeading: 'TƯỜNG LỬA PROMPT ĐA VECTOR OWASP',
    budgetBreakerHeading: 'BỘ NGẮT MẠCH NGÂN SÁCH TOKEN / USD',
    waterfallReplayTitle: 'PHÁT LẠI THÁC NƯỚC ĐỘ TRỄ P95 & CHI PHÍ USD THEO NHÁNH DAG',
    waterfallReplaySubtitle: 'Mô phỏng từng bước độ trễ P95 tích lũy và chi phí USD qua từng node tác tử theo nhánh thực thi',
    tabOrchestrator: 'Điều Phối DAG',
    tabFirewall: 'Tường Lửa OWASP',
    tabRoutingArena: 'Đấu Trường Pareto',
    tabAuditOtlp: 'Kiểm Toán & OTLP',
    themeDaylight: 'Sáng Studio',
    themeObsidian: 'Đen Obsidian',
    arenaTitle: 'ĐẤU TRƯỜNG ĐỊNH TUYẾN FINOPS ĐA MODEL & ĐƯỜNG BIÊN PARETO',
    arenaSubtitle: '6 mô hình LLM đầu bảng & mã nguồn mở · Bộ định tuyến phân tầng tối ưu · Biểu đồ biên Pareto Chi phí - Chất lượng',
    arenaVolumeLabel: 'Lưu Lượng Request / Tháng',
    arenaQualityFloorLabel: 'Sàn Chất Lượng Xác Thực',
    arenaLatencyBudgetLabel: 'Ngân Sách Độ Trễ P95',
    arenaCacheHitLabel: 'Tỷ Lệ Trúng Prompt Cache',
  },
};
