export const supportedLocales = ['en', 'zh-CN', 'ja-JP'];
export const defaultLocale = 'en';

export const messages = {
  en: {
    pageTitle: 'TradeProof · Real-World Proof before Real-World Assets',
    pageDescription: 'Create holder-controlled Real-World Proof for trade, share privacy-bounded Proof Cards, collect responsible responses and anchor exact digests on Base Sepolia.',
    announcement: '<b>RWP Core + Viral Proof Cards are live.</b> <a href="./rwp.html">Create a privacy-bounded Proof Card →</a> · Registry live on Base Sepolia · no sale is active.',
    navProduct: 'Product', navNetwork: 'Network', navEconomics: 'Economics', navRoadmap: 'Roadmap', navLaunch: 'Open RWP', languageLabel: 'Language',
    liveBase: 'Live on Base Sepolia', tokenNotLive: '$TPROOF · Not live', openProtocol: 'RWP Core · v0.1',
    heroLine1: 'Before RWA,', heroLine2: 'prove reality.', heroLead: 'Trade creates value. RWP links claims to evidence, field-level provenance and responsible responses. Agents make it scalable; contributors own the open network.',
    createPassport: 'Create Trade RWP', openExample: 'Generate Viral Proof Card', viewEconomics: 'View token economics ↓', proofNoWallet: 'No wallet required to start', proofPrivacy: 'Share proofs, not secrets', proofOpen: 'Open schemas and verifier',
    consoleStatus: 'PRODUCT ONLINE', consoleSubtitle: 'RWP + contribution economy', statNetwork: 'Network', statRegistry: 'Registry', statDeployed: 'Deployed', statSale: 'Public sale', statInactive: 'Inactive',
    flowCreate: 'Compile Trade RWP', flowCreateSub: 'Claims · evidence · provenance', flowRespond: 'Collect response', flowRespondSub: 'Confirm · reject · change', flowAnchor: 'Anchor exact digest', flowAnchorSub: 'Chronology, not automatic truth', flowReward: 'Reward contribution', flowRewardSub: 'Future gated capability',
    productKicker: 'RWP is live', productTitle: 'A useful proof protocol—not an air-token story.', productLead: 'The current release already lets a trade participant create a holder-controlled proof object, preserve field-level provenance, share a bounded card, collect a response and verify an exact digest.',
    cardCreateTitle: 'Build a Passport', cardCreateText: 'Generate a standards-shaped local JSON package for a trade case. No account and no upload.', cardCreateCta: 'Create now →', cardShareTitle: 'Generate a Viral Proof Card', cardShareText: 'Share proof structure and cryptographic integrity without exposing names, statements, evidence URIs, document contents or evidence digests.', cardShareCta: 'Import and share →', cardRespondTitle: 'Turn viewing into action', cardRespondText: 'A counterparty can confirm, reject or request a change and send a standard response object back.', cardRespondCta: 'Review and respond →', cardExampleTitle: 'See a complete example', cardExampleText: 'The synthetic steel-cabinet case demonstrates claims, evidence references, field-level provenance, roles, confirmations and explicit boundaries.', cardExampleCta: 'Open the example →', cardBuildTitle: 'Integrate the open standard', cardBuildText: 'Use the public schema, examples and dependency-free verifier in an ERP, Agent, wallet, inspection or logistics workflow.', cardBuildCta: 'Explore GitHub →',
    networkKicker: 'Useful viral loop', networkTitle: 'Every shared RWP can create the next real workflow.', networkLead: 'A holder shares a bounded Proof Card, a recipient inspects or requests authorized evidence, responds, and can become the next creator. Views, wallet connects and copied cards earn nothing.', loop1Title: 'Create', loop1Text: 'Compile claims, evidence references, provenance and lifecycle state.', loop2Title: 'Invite', loop2Text: 'Send a privacy-bounded Proof Card to a buyer, inspector or logistics party.', loop3Title: 'Respond', loop3Text: 'Confirm, reject or request a change using a standard object.', loop4Title: 'Anchor', loop4Text: 'Optionally anchor the canonical digest and its chronology onchain.', loop5Title: 'Reuse', loop5Text: 'The recipient can reuse the open pattern and create the next RWP.',
    chainKicker: 'Onchain proof layer', chainTitle: 'The contract is deployed. The documents stay private.', chainLead: 'TradeProofRegistry records digest integrity, chronology, version replacement and revocation. It does not publish source files or claim that a real-world fact is automatically true.', chainBadge: 'Canonical testnet deployment', chainText: 'Anchors canonical Passport and Response digests with issuer, timestamp, schema profile, supersession and revocation state.', copyContract: 'Copy contract', openExplorer: 'Open explorer ↗', contractSource: 'Contract source ↗', deploymentFacts: 'Deployment facts', networkLabel: 'Network', blockLabel: 'Block', compilerLabel: 'Compiler', verificationLabel: 'Source verification', pendingLabel: 'Pending',
    economicsKicker: 'Contributor economics', economicsTitle: '$TPROOF is designed around network value—not empty traffic.', economicsLead: 'The public draft prioritizes useful cross-organization responses, repeat adoption, integrations, standards work and security contributions. Token validity never controls proof validity.', draftToken: 'DRAFT TOKEN · NOT LIVE', tokenSummary: 'A future contribution, governance and ecosystem-access token for people and organizations that grow the TradeProof Network through measurable work.', noSaleStrong: 'No sale is active.', noSaleText: 'No price, return, revenue share, trade-asset ownership or listing is promised. Final rights, supply and distribution remain subject to technical, legal and community review.', allocationDraft: 'draft allocation', allocCommunity: 'Community contributions', allocCommunityText: 'Useful responses, standards work and repeat adoption.', allocEcosystem: 'Ecosystem & developer fund', allocEcosystemText: 'Open tools, adapters, connectors and public infrastructure.', allocTeam: 'Core team · long vesting', allocTeamText: 'Long-term development with no instant unlock.', allocAdoption: 'Real adoption incentives', allocAdoptionText: 'Repeat cross-party workflows, not wallet invitations.', allocLiquidity: 'Liquidity bootstrapping reserve', allocLiquidityText: 'Gated reserve; no active market or sale.', allocSecurity: 'Security & standards reserve', allocSecurityText: 'Audits, findings and standards maintenance.', econSupply: 'Final supply', underReview: 'Under review', econLaunch: 'Launch status', notLive: 'Not live', econRule: 'Core rule', proofIndependent: 'Proof validity stays independent', readEconomics: 'Read Token Economics', simulateGenesis: 'Simulate Genesis Proof', shareProject: 'Share the project',
    roadmapKicker: 'Build sequence', roadmapTitle: 'Utility first. Contribution next. Token last.', roadmapLead: 'The token grows out of observable contribution receipts rather than replacing product adoption.', phase1: 'PHASE 01 · DONE', phase1Title: 'Open Passport standard', phase1Text: 'Schema, example, verifier, local generator, public sharing and bounded responses.', phase2: 'PHASE 02 · DONE', phase2Title: 'Onchain Registry', phase2Text: 'Canonical Base Sepolia deployment with digest anchoring, replacement and revocation.', phase3: 'PHASE 03 · NOW', phase3Title: 'RWP + contribution layer', phase3Text: 'Field-level provenance and useful participation without letting rewards control evidence validity.', phase4: 'PHASE 04 · NEXT', phase4Title: '$TPROOF testnet', phase4Text: 'Fixed-supply token, vesting, governance boundaries and contribution-based eligibility.',
    finalKicker: 'Start with reality', finalTitle: 'Create an RWP that invites the next responsible organization.', finalLead: 'Use the live browser tools now. Share proof structure instead of secrets, and grow the open network through real workflow rather than speculation.', finalCreate: 'Create Trade RWP', finalVerify: 'Import and verify', finalRespond: 'Respond to a proof', footerNote: 'TradeProof · RWP community draft v0.1 · Experimental and unaudited.', footerExample: 'Example', footerCreate: 'Create', footerVerify: 'Verify', footerRespond: 'Respond', copied: 'Copied ✓', copyFailed: 'Copy failed', shareText: 'Before Real-World Assets, there must be Real-World Proof. Share proofs, not secrets.'
  },
  'zh-CN': {
    pageTitle: 'TradeProof · 现实资产之前，必须先有现实证明', pageDescription: '从全球贸易开始，创建由数据持有人控制的现实证明，分享隐私受控 Proof Card，收集责任方回应，并在 Base Sepolia 锚定精确摘要。',
    announcement: '<b>RWP Core 与 Viral Proof Card 已上线。</b> <a href="./rwp.html">生成隐私受控 Proof Card →</a> · Registry 已部署至 Base Sepolia · 当前没有任何销售。',
    navProduct: '产品', navNetwork: '网络', navEconomics: '经济模型', navRoadmap: '路线图', navLaunch: '打开 RWP', languageLabel: '语言',
    liveBase: '已上线 Base Sepolia', tokenNotLive: '$TPROOF · 尚未上线', openProtocol: 'RWP 核心 · v0.1',
    heroLine1: '现实资产之前，', heroLine2: '先证明现实。', heroLead: '贸易创造价值。RWP 把事实主张连接到证据、字段级来源和责任方回应。Agent 实现规模，贡献者共同拥有开放网络。',
    createPassport: '创建 Trade RWP', openExample: '生成 Viral Proof Card', viewEconomics: '查看代币经济 ↓', proofNoWallet: '开始无需钱包', proofPrivacy: '只分享证明，不交出秘密', proofOpen: '开放 Schema 与验证器',
    consoleStatus: '产品已在线', consoleSubtitle: 'RWP + 贡献经济', statNetwork: '网络', statRegistry: '登记合约', statDeployed: '已部署', statSale: '公开销售', statInactive: '未开启',
    flowCreate: '编译 Trade RWP', flowCreateSub: '主张 · 证据 · 来源', flowRespond: '收集标准回应', flowRespondSub: '确认 · 拒绝 · 要求修改', flowAnchor: '锚定精确摘要', flowAnchorSub: '证明时间与一致性，不自动证明事实', flowReward: '奖励真实贡献', flowRewardSub: '未来受门禁控制的能力',
    productKicker: 'RWP 已可使用', productTitle: '这是有真实用途的证明协议，不是空气币故事。', productLead: '当前版本已经支持贸易参与方创建自持证明对象、保存字段级来源、分享隐私受控卡片、收集回应并验证精确摘要。',
    cardCreateTitle: '创建贸易护照', cardCreateText: '为贸易案件生成符合标准结构的本地 JSON，无需账户，也不上传文件。', cardCreateCta: '立即创建 →', cardShareTitle: '生成 Viral Proof Card', cardShareText: '只分享证明结构和密码学完整性，不暴露名称、事实陈述、证据 URI、原始文件内容或证据摘要。', cardShareCta: '导入并分享 →', cardRespondTitle: '让查看变成行动', cardRespondText: '交易对手可确认、拒绝或要求修改，并返回标准回应对象。', cardRespondCta: '审查并回应 →', cardExampleTitle: '查看完整示例', cardExampleText: '合成钢柜案例展示事实主张、证据引用、字段级来源、角色、确认与明确边界。', cardExampleCta: '打开示例 →', cardBuildTitle: '集成开放标准', cardBuildText: '把公开 Schema、示例和零依赖验证器接入 ERP、Agent、钱包、检验或物流流程。', cardBuildCta: '查看 GitHub →',
    networkKicker: '有用的 Viral Loop', networkTitle: '每一份被分享的 RWP，都能开启下一条真实工作流。', networkLead: '持有人分享受控 Proof Card，接收方检查、申请授权证据、作出回应，并可能成为下一位创建者。浏览量、连接钱包和复制卡片都不产生贡献。', loop1Title: '创建', loop1Text: '编译事实主张、证据引用、字段级来源与生命周期状态。', loop2Title: '邀请', loop2Text: '向买方、检验方或物流方发送隐私受控 Proof Card。', loop3Title: '回应', loop3Text: '用标准对象确认、拒绝或要求修改。', loop4Title: '锚定', loop4Text: '可选地在链上锚定规范摘要与时间顺序。', loop5Title: '复用', loop5Text: '接收方复用开放模式并创建下一份 RWP。',
    chainKicker: '链上证明层', chainTitle: '合约已经部署，原始文件仍保持私密。', chainLead: 'TradeProofRegistry 记录摘要完整性、时间顺序、版本替换和撤销状态；它不公开源文件，也不声称链上记录自动证明现实事实。', chainBadge: '规范测试网部署', chainText: '锚定 Passport 与 Response 的规范摘要、签发钱包、时间戳、Schema Profile、替换与撤销状态。', copyContract: '复制合约地址', openExplorer: '打开浏览器 ↗', contractSource: '查看合约源码 ↗', deploymentFacts: '部署事实', networkLabel: '网络', blockLabel: '区块', compilerLabel: '编译器', verificationLabel: '源码验证', pendingLabel: '待完成',
    economicsKicker: '贡献者经济模型', economicsTitle: '$TPROOF 围绕网络价值设计，而不是围绕空流量设计。', economicsLead: '公开草案优先奖励有用的跨组织回应、重复采用、集成、标准工作与安全贡献。代币状态永远不能决定证明对象是否有效。', draftToken: '代币草案 · 尚未上线', tokenSummary: '未来用于贡献记录、治理和生态访问的代币，面向通过可衡量工作扩展 TradeProof 网络的个人与组织。', noSaleStrong: '当前没有任何销售。', noSaleText: '不承诺价格、收益、收入分成、贸易资产所有权或交易所上线。最终权利、供应量与分配仍需技术、法律和社区审查。', allocationDraft: '分配草案', allocCommunity: '社区贡献', allocCommunityText: '有用回应、标准工作与重复采用。', allocEcosystem: '生态与开发者基金', allocEcosystemText: '开放工具、适配器、连接器与公共基础设施。', allocTeam: '核心团队 · 长期归属', allocTeamText: '长期开发，不设置即时解锁。', allocAdoption: '真实采用激励', allocAdoptionText: '奖励重复跨组织流程，而不是邀请钱包。', allocLiquidity: '流动性启动储备', allocLiquidityText: '受门禁控制；当前没有市场或销售。', allocSecurity: '安全与标准储备', allocSecurityText: '审计、安全发现和标准维护。', econSupply: '最终供应量', underReview: '审查中', econLaunch: '上线状态', notLive: '尚未上线', econRule: '核心规则', proofIndependent: '证明有效性保持独立', readEconomics: '阅读代币经济', simulateGenesis: '模拟 Genesis Proof', shareProject: '分享项目',
    roadmapKicker: '建设顺序', roadmapTitle: '先有用途，再有贡献，最后才是代币。', roadmapLead: '代币从可观察的贡献凭证中生长，而不是替代产品采用。', phase1: '阶段 01 · 已完成', phase1Title: '开放 Passport 标准', phase1Text: 'Schema、示例、验证器、本地生成器、公开分享和有边界回应。', phase2: '阶段 02 · 已完成', phase2Title: '链上 Registry', phase2Text: 'Base Sepolia 规范部署，支持摘要锚定、替换与撤销。', phase3: '阶段 03 · 当前', phase3Title: 'RWP 与贡献层', phase3Text: '加入字段级来源并记录有用参与，同时不让奖励控制证据有效性。', phase4: '阶段 04 · 下一步', phase4Title: '$TPROOF 测试网', phase4Text: '固定供应、归属、治理边界和基于贡献的资格。',
    finalKicker: '从现实开始', finalTitle: '创建一份能够邀请下一个责任组织参与的 RWP。', finalLead: '现在就使用在线浏览器工具，只分享证明结构而不交出秘密，并通过真实工作流而不是投机扩展开放网络。', finalCreate: '创建 Trade RWP', finalVerify: '导入并验证', finalRespond: '回应证明对象', footerNote: 'TradeProof · RWP 社区草案 v0.1 · 实验性且未经审计。', footerExample: '示例', footerCreate: '创建', footerVerify: '验证', footerRespond: '回应', copied: '已复制 ✓', copyFailed: '复制失败', shareText: '现实资产之前，必须先有现实证明。只分享证明，不交出秘密。'
  },
  'ja-JP': {
    pageTitle: 'TradeProof · RWA の前に、Real-World Proof を', pageDescription: 'グローバル貿易から始め、データ保有者が管理する Real-World Proof を作成し、境界付き Proof Card を共有し、責任主体の応答と正確なダイジェストを記録します。',
    announcement: '<b>RWP Core と Viral Proof Card が公開されました。</b> <a href="./rwp.html">境界付き Proof Card を作成 →</a> · Registry は Base Sepolia で稼働中 · 公開販売はありません。',
    navProduct: 'プロダクト', navNetwork: 'ネットワーク', navEconomics: '経済設計', navRoadmap: 'ロードマップ', navLaunch: 'RWP を開く', languageLabel: '言語',
    liveBase: 'Base Sepolia で稼働中', tokenNotLive: '$TPROOF · 未稼働', openProtocol: 'RWP Core · v0.1',
    heroLine1: 'RWA の前に、', heroLine2: '現実を証明する。', heroLead: '貿易が価値を生みます。RWP は主張を証拠、フィールド単位の出所、責任主体の応答へ結びます。Agent が拡張し、貢献者がオープンネットワークを共有します。',
    createPassport: 'Trade RWP を作成', openExample: 'Viral Proof Card を生成', viewEconomics: 'トークン経済を見る ↓', proofNoWallet: '開始時にウォレット不要', proofPrivacy: '秘密ではなく証明を共有', proofOpen: '公開 Schema と検証ツール',
    consoleStatus: 'プロダクト稼働中', consoleSubtitle: 'RWP + 貢献経済', statNetwork: 'ネットワーク', statRegistry: 'Registry', statDeployed: 'デプロイ済み', statSale: '公開販売', statInactive: '未実施',
    flowCreate: 'Trade RWP をコンパイル', flowCreateSub: '主張 · 証拠 · 出所', flowRespond: '標準応答を収集', flowRespondSub: '確認 · 拒否 · 変更要求', flowAnchor: '正確なダイジェストを記録', flowAnchorSub: '時系列を証明し、事実を自動認定しない', flowReward: '貢献を評価', flowRewardSub: '将来のゲート付き機能',
    productKicker: 'RWP は利用可能', productTitle: '空のトークン物語ではなく、実用的な証明プロトコル。', productLead: '現行版では、保有者管理の証明オブジェクト、フィールド単位の出所、境界付きカード、責任主体の応答、正確なダイジェスト検証をブラウザで利用できます。',
    cardCreateTitle: 'Passport を作る', cardCreateText: 'アカウントやアップロードなしで、標準形のローカル JSON を生成します。', cardCreateCta: '今すぐ作成 →', cardShareTitle: 'Viral Proof Card を生成', cardShareText: '名前、主張本文、証拠 URI、元文書、証拠ダイジェストを公開せず、証明構造と暗号学的完全性だけを共有します。', cardShareCta: 'インポートして共有 →', cardRespondTitle: '閲覧を行動につなげる', cardRespondText: '取引相手は確認、拒否、変更要求を行い、標準 Response を返せます。', cardRespondCta: 'レビューして応答 →', cardExampleTitle: '完全な例を見る', cardExampleText: '合成スチールキャビネット案件で、主張、証拠参照、フィールド単位の出所、役割、確認、境界を示します。', cardExampleCta: '例を開く →', cardBuildTitle: 'オープン標準を統合', cardBuildText: '公開 Schema、例、依存なし検証ツールを ERP、Agent、ウォレット、検査、物流に接続できます。', cardBuildCta: 'GitHub を見る →',
    networkKicker: '実用的な Viral Loop', networkTitle: '共有された RWP が次の実業務フローを生みます。', networkLead: '保有者が境界付き Proof Card を共有し、受信者が確認、許可された証拠の要求、応答を行い、次の作成者になります。閲覧、ウォレット接続、カード複製には貢献価値がありません。', loop1Title: '作成', loop1Text: '主張、証拠参照、フィールド単位の出所、ライフサイクル状態をまとめます。', loop2Title: '招待', loop2Text: '買い手、検査会社、物流会社へ境界付き Proof Card を送ります。', loop3Title: '応答', loop3Text: '標準オブジェクトで確認、拒否、変更要求を行います。', loop4Title: '記録', loop4Text: '必要に応じて正規ダイジェストと時系列をオンチェーンに記録します。', loop5Title: '再利用', loop5Text: '受信者がオープンパターンを再利用し、次の RWP を作成します。',
    chainKicker: 'オンチェーン証明層', chainTitle: 'コントラクトはデプロイ済み。文書は非公開のままです。', chainLead: 'TradeProofRegistry はダイジェストの完全性、時系列、置換、失効を記録します。元文書を公開せず、現実の事実を自動的に真と認定しません。', chainBadge: '正規テストネットデプロイ', chainText: 'Passport と Response の正規ダイジェスト、発行者、時刻、Schema Profile、置換、失効を記録します。', copyContract: 'アドレスをコピー', openExplorer: 'Explorer を開く ↗', contractSource: 'コントラクトソース ↗', deploymentFacts: 'デプロイ情報', networkLabel: 'ネットワーク', blockLabel: 'ブロック', compilerLabel: 'コンパイラ', verificationLabel: 'ソース検証', pendingLabel: '保留中',
    economicsKicker: '貢献者経済', economicsTitle: '$TPROOF は空のトラフィックではなく、ネットワーク価値を中心に設計します。', economicsLead: '公開草案は、有用な組織間応答、継続利用、統合、標準化、安全性への貢献を優先します。トークン状態が証明の有効性を決めることはありません。', draftToken: 'トークン草案 · 未稼働', tokenSummary: '測定可能な活動で TradeProof Network を成長させる個人と組織のための、将来の貢献・ガバナンス・エコシステムアクセス用トークンです。', noSaleStrong: '販売は行っていません。', noSaleText: '価格、リターン、収益分配、貿易資産の所有、上場を約束しません。最終的な権利、供給量、配分は技術・法務・コミュニティの審査対象です。', allocationDraft: '配分草案', allocCommunity: 'コミュニティ貢献', allocCommunityText: '有用な応答、標準化、継続利用。', allocEcosystem: 'エコシステム・開発者基金', allocEcosystemText: '公開ツール、アダプター、コネクター、公共基盤。', allocTeam: 'コアチーム · 長期ベスティング', allocTeamText: '即時アンロックなしの長期開発。', allocAdoption: '実利用インセンティブ', allocAdoptionText: 'ウォレット招待ではなく、反復する組織間フロー。', allocLiquidity: '流動性立ち上げ準備枠', allocLiquidityText: 'ゲート管理。現在市場も販売もありません。', allocSecurity: 'セキュリティ・標準準備枠', allocSecurityText: '監査、脆弱性報告、標準保守。', econSupply: '最終供給量', underReview: '審査中', econLaunch: 'ローンチ状態', notLive: '未稼働', econRule: '基本ルール', proofIndependent: '証明の有効性は独立', readEconomics: 'Token Economics を読む', simulateGenesis: 'Genesis Proof を試す', shareProject: 'プロジェクトを共有',
    roadmapKicker: '構築順序', roadmapTitle: 'まず実用、次に貢献、トークンは最後。', roadmapLead: 'トークンはプロダクト利用を置き換えるのではなく、観測可能な貢献記録から育ちます。', phase1: 'PHASE 01 · 完了', phase1Title: 'Open Passport 標準', phase1Text: 'Schema、例、検証、ローカル生成、公開共有、境界付き応答。', phase2: 'PHASE 02 · 完了', phase2Title: 'オンチェーン Registry', phase2Text: 'Base Sepolia の正規デプロイ。ダイジェスト記録、置換、失効。', phase3: 'PHASE 03 · 現在', phase3Title: 'RWP + 貢献レイヤー', phase3Text: 'フィールド単位の出所と有用な参加を記録し、報酬が証拠の有効性を支配しないようにします。', phase4: 'PHASE 04 · 次', phase4Title: '$TPROOF テストネット', phase4Text: '固定供給、ベスティング、ガバナンス境界、貢献ベース資格。',
    finalKicker: '現実から始める', finalTitle: '次の責任組織を招待する RWP を作成しましょう。', finalLead: 'ライブのブラウザツールを使い、秘密ではなく証明構造を共有し、投機ではなく実業務からオープンネットワークを育てます。', finalCreate: 'Trade RWP を作成', finalVerify: 'インポートして検証', finalRespond: '証明に応答', footerNote: 'TradeProof · RWP コミュニティ草案 v0.1 · 実験段階・未監査。', footerExample: '例', footerCreate: '作成', footerVerify: '検証', footerRespond: '応答', copied: 'コピーしました ✓', copyFailed: 'コピーに失敗', shareText: 'RWA の前に Real-World Proof が必要です。秘密ではなく証明を共有します。'
  }
};

export function normalizeLocale(value = '') {
  const locale = String(value).trim();
  if (supportedLocales.includes(locale)) return locale;
  const lower = locale.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('ja')) return 'ja-JP';
  return defaultLocale;
}

export function getMessage(locale, key) {
  const normalized = normalizeLocale(locale);
  return messages[normalized]?.[key] ?? messages[defaultLocale]?.[key] ?? key;
}

function applyRwpEntryPoints() {
  const launch = document.querySelector('[data-i18n="navLaunch"]');
  if (launch) launch.setAttribute('href', './rwp.html');

  const proofCardCta = document.querySelector('[data-i18n="openExample"]');
  if (proofCardCta) proofCardCta.setAttribute('href', './rwp.html');

  const nav = document.querySelector('.navlinks');
  if (nav && !nav.querySelector('[data-rwp-home-link]')) {
    const link = document.createElement('a');
    link.href = './rwp.html';
    link.textContent = 'RWP';
    link.setAttribute('data-rwp-home-link', 'true');
    nav.prepend(link);
  }
}

function applyLocale(locale) {
  const normalized = normalizeLocale(locale);
  document.documentElement.lang = normalized;
  document.title = getMessage(normalized, 'pageTitle');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', getMessage(normalized, 'pageDescription'));

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    const value = getMessage(normalized, key);
    if (key === 'announcement') element.innerHTML = value;
    else element.textContent = value;
  });

  const selector = document.getElementById('languageSelect');
  if (selector) selector.value = normalized;
  const url = new URL(window.location.href);
  if (normalized === defaultLocale) url.searchParams.delete('lang');
  else url.searchParams.set('lang', normalized);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  try { window.localStorage.setItem('tradeProofLocale', normalized); } catch {}
  return normalized;
}

function initialLocale() {
  const params = new URLSearchParams(window.location.search);
  const queryLocale = params.get('lang');
  if (queryLocale) return normalizeLocale(queryLocale);
  try {
    const stored = window.localStorage.getItem('tradeProofLocale');
    if (stored) return normalizeLocale(stored);
  } catch {}
  return normalizeLocale(window.navigator.language);
}

if (typeof document !== 'undefined') {
  applyRwpEntryPoints();
  const locale = applyLocale(initialLocale());
  const selector = document.getElementById('languageSelect');
  selector?.addEventListener('change', (event) => applyLocale(event.currentTarget.value));
  window.tradeProofI18n = {
    locale,
    t: (key) => getMessage(document.documentElement.lang, key),
    setLocale: applyLocale
  };
}
