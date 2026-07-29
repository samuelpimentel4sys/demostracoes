import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClauseParameter, PaymentMethod, Rule, RuleAction, RuleClause, RuleLayer, RuleLogic } from '../../models/rule.model';
import { RuleService } from '../../services/rule.service';
import { ImpactComponent } from '../impact/impact';

@Component({
  selector: 'app-rule-form',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, ImpactComponent],
  template: `
    <div class="rule-form-page">
      <nav class="breadcrumb">
        <a routerLink="/regras">Portal Antifraude</a><b>/</b>
        <a routerLink="/regras">Regras Globais e por Loja</a><b>/</b>
        <span>{{ isEditMode() ? 'Edição de Regra #' + (ruleId() || '06') : 'Nova Regra Antifraude' }}</span>
      </nav>

      <section class="form-card">
        <header class="form-header">
          <div>
            <h1>
              {{
                isEditMode()
                  ? 'Edição de Regra Antifraude - ' + (form.value.name || 'Device Fingerprint + Geolocalização')
                  : 'Nova Regra Antifraude'
              }}
            </h1>
            <p>
              Configure o escopo de loja, meios de pagamento, decisão, camada de análise, prioridade,
              cláusulas condicionais e governança CMN 4.966.
            </p>
          </div>
          <span class="badge-head">REGRAS & RISCO</span>
        </header>

        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="global-banner">
            <strong>GLOBAL</strong>
            <span>Regra de Escopo Global: Esta regra será aplicada em <b>TODAS as lojas ativas no ecossistema.</b></span>
          </div>

          <section class="form-section">
            <h2>1. Dados Gerais da Regra</h2>

            <label class="field">
              <span>Nome da Regra * (CT-DN6-04)</span>
              <input formControlName="name" placeholder="Ex.: Bloqueio de Suspeita Device Fingerprint + Geolocalização Divergente" />
              @if (form.controls.name.touched && form.controls.name.invalid) {
                <small class="error-msg">O nome da regra é obrigatório.</small>
              }
            </label>

            <label class="field">
              <span>Descrição / Objetivo do Risco (Auditável CMN 4.966)</span>
              <textarea rows="3" formControlName="description" placeholder="Descreva o propósito da regra para a trilha de auditoria..."></textarea>
            </label>

            <div class="field">
              <span>Validade para Meios de Pagamento:</span>
              <div class="payment-row">
                @for (method of paymentOptions; track method.value) {
                  <label class="payment-pill" [class.selected]="hasPayment(method.value)">
                    <input
                      type="checkbox"
                      [checked]="hasPayment(method.value)"
                      (change)="togglePayment(method.value)"
                    />
                    <span>{{ hasPayment(method.value) ? '☑' : '☐' }} {{ method.label }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="two-columns">
              <div>
                <label class="sub-label">Lógica Operacional (Condição)</label>
                <div class="logic-cards-row">
                  <label class="logic-card" [class.selected]="form.value.logic === 'AND'">
                    <input type="radio" formControlName="logic" value="AND" />
                    <b>E (AND) - Conjunção</b>
                    <small>Dispara quando a transação atende a TODAS as cláusulas combinadas.</small>
                  </label>
                  <label class="logic-card" [class.selected]="form.value.logic === 'OR'">
                    <input type="radio" formControlName="logic" value="OR" />
                    <b>OU (OR) - Disjunção</b>
                    <small>Dispara quando qualquer cláusula for satisfeita.</small>
                  </label>
                </div>
              </div>

              <div>
                <label class="sub-label">Decisão / Ação Antifraude (RN2)</label>
                <div class="decision-group">
                  <button
                    type="button"
                    [class.selected]="form.value.action === 'APPROVE'"
                    (click)="setAction('APPROVE')"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    class="review"
                    [class.selected]="form.value.action === 'REVIEW'"
                    (click)="setAction('REVIEW')"
                  >
                    ✓ REVISAR
                  </button>
                  <button
                    type="button"
                    class="decline"
                    [class.selected]="form.value.action === 'DECLINE'"
                    (click)="setAction('DECLINE')"
                  >
                    Negar
                  </button>
                </div>

                @if (form.value.action === 'DECLINE' && form.value.logic === 'AND') {
                  <div class="warning-banner-rn2">
                    <span>⚠️ <b>Aviso Orientativo RN2:</b> Para regras combinadas com operador E (AND), a recomendação padrão de governança é a ação <b>REVISAR</b> para prevenção de falsos positivos em compras legítimas.</span>
                  </div>
                }
              </div>
            </div>
          </section>

          <!-- Seção 2: Construtor Dinâmico de Cláusulas Condicionais (CT-DN2-01..06) -->
          <section class="form-section">
            <h2>2. Cláusulas Condicionais (Device Fingerprint + Geolocalização)</h2>
            <p class="section-desc">Selecione e configure os parâmetros de risco de Fingerprint, Geolocalização ou atributos de pagamento.</p>

            <div class="add-clause-bar">
              <label for="param-select">Adicionar Parâmetro:</label>
              <select id="param-select" #paramSelect class="param-dropdown">
                @for (param of availableParameters(); track param.id) {
                  <option [value]="param.id">{{ param.name }}</option>
                }
              </select>
              <button type="button" class="btn-outline-teal btn-sm" (click)="addClauseFromSelect(paramSelect.value)">
                ＋ Adicionar Cláusula
              </button>

            </div>

            @if (clauseError()) {
              <div class="clause-error-alert">
                <span>⚠️ {{ clauseError() }}</span>
              </div>
            }

            <div class="clauses-box">
              @if (clauses().length === 0) {
                <div class="empty-clauses">
                  <span>Nenhuma cláusula configurada. Selecione um parâmetro acima para adicionar.</span>
                </div>
              } @else {
                @for (clause of clauses(); track clause.id; let idx = $index) {
                  <article class="clause-item">
                    <div class="clause-header">
                      <span class="clause-badge">Cláusula #0{{ idx + 1 }}</span>
                      <strong class="clause-title">{{ clause.parameterName }}</strong>
                      <button type="button" class="btn-danger-outline btn-sm" (click)="removeClause(clause.id)">✕ Remover</button>

                    </div>

                    <div class="clause-controls">
                      <label>
                        <span>Operador:</span>
                        <select [ngModel]="clause.operator" (ngModelChange)="updateClauseOperator(clause.id, $event)" [ngModelOptions]="{standalone: true}">
                          @for (op of getOperatorsForParam(clause.parameterId); track op) {
                            <option [value]="op">{{ op }}</option>
                          }
                        </select>
                      </label>

                      <label>
                        <span>Valor do Parâmetro * (CT-DN2-04):</span>
                        <input
                          type="text"
                          [ngModel]="clause.value"
                          (ngModelChange)="updateClauseValue(clause.id, $event)"
                          [ngModelOptions]="{standalone: true}"
                          placeholder="Ex: SIM, BRASIL, 1500..."
                          [class.invalid]="String(clause.value).trim() === ''"
                        />
                      </label>
                    </div>
                  </article>

                  @if (idx < clauses().length - 1) {
                    <div class="connector-badge">
                      {{ form.value.logic === 'AND' ? 'E (AND)' : 'OU (OR)' }}
                    </div>
                  }
                }
              }
            </div>
          </section>

          <!-- Seção 3: Governança e Rastreabilidade CMN 4.966 (CT-DN5-01..06) -->
          <section class="form-section">
            <h2>3. Configurações Avançadas de Análise & Governança (Resolução CMN nº 4.966/21)</h2>
            
            <div class="governance-grid">
              <label class="field">
                <span>PRD de Origem * (Obrigatório CMN 4.966 / LGPD)</span>
                <input formControlName="prdOrigin" placeholder="PRD - Antifraude Device Fingerprint Geolocalização" />
                @if (form.controls.prdOrigin.touched && form.controls.prdOrigin.invalid) {
                  <small class="error-msg">O PRD de Origem é obrigatório para auditoria.</small>
                }
              </label>

              <label class="field">
                <span>Autor / Responsável</span>
                <input formControlName="createdBy" readonly class="readonly-input" />
              </label>

              <label class="field">
                <span>Comitê / Aprovador de Risco</span>
                <input formControlName="approvedBy" />
              </label>
            </div>

            <div class="advanced-card">
              <div>
                <span>Camada de Análise</span>
                <strong>◉ 1ª Camada (Filtro Rápido)</strong>
              </div>
              <div>
                <span>Prioridade na Engine</span>
                <strong>#06 (Ordem de Execução)</strong>
              </div>
              <div>
                <span>Ghost Mode (Simulação A/B)</span>
                <label class="ghost-toggle-label">
                  <input type="checkbox" formControlName="ghostMode" />
                  <strong [class.active-ghost]="form.value.ghostMode">
                    {{ form.value.ghostMode ? '👻 HABILITADO (Modo Fantasma Ativo)' : '⚪ DESABILITADO (Modo Decisório Real)' }}
                  </strong>
                </label>
              </div>
              <div>
                <span>Rastreabilidade CMN 4.966</span>
                <small>Timestamp ISO 8601 UTC: {{ auditTimestamp() }}</small>
              </div>
            </div>
          </section>

          <footer class="form-actions">
            <a routerLink="/regras" class="btn-secondary">Voltar para Regras</a>
            <div class="action-buttons-right">
              <button type="submit" class="btn-secondary">
                💾 Salvar Regra
              </button>

              <button
                type="button"
                class="btn-primary"
                [disabled]="isSimulateDisabled()"
                [title]="isSimulateDisabled() ? 'Configure ao menos uma cláusula com valor preenchido para simular impacto.' : 'Simular impacto retrospectivo dos últimos 30 dias'"
                (click)="openImpactModal()"
              >
                🚀 Simular Impacto e Ativar
              </button>
            </div>
          </footer>

        </form>
      </section>

      @if (showImpactModal()) {
        <app-impact [ruleData]="getRuleObjectForImpact()" (close)="showImpactModal.set(false)" />
      }
    </div>
  `,
  styleUrl: './rule-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly ruleService = inject(RuleService);

  readonly isEditMode = signal(false);
  readonly ruleId = signal<string | null>(null);
  readonly selectedPayments = signal<PaymentMethod[]>(['cartao', 'pix', 'voucher']);
  readonly showImpactModal = signal(false);
  readonly clauseError = signal<string | null>(null);

  readonly clauses = signal<RuleClause[]>([
    {
      id: 'clause-106-1',
      parameterId: 'param-11',
      parameterName: 'Device fingerprint já visto em outra conta',
      operator: '==',
      value: 'SIM'
    },
    {
      id: 'clause-106-2',
      parameterId: 'param-12',
      parameterName: 'Localização diverge do histórico do comprador',
      operator: '==',
      value: 'SIM'
    }
  ]);

  readonly auditTimestamp = signal<string>(new Date().toISOString());

  readonly availableParameters = computed(() => this.ruleService.availableParameters());

  readonly isSimulateDisabled = computed(() => {
    const list = this.clauses();
    if (list.length === 0) return true;
    return list.some(c => String(c.value).trim() === '');
  });

  readonly String = String;

  readonly paymentOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'cartao', label: 'Cartão de Crédito' },
    { value: 'pix', label: 'PIX / EAD' },
    { value: 'voucher', label: 'Voucher' },
    { value: 'boleto', label: 'Boleto Bancário' },
  ];

  readonly form = this.fb.group({
    name: [
      'Bloqueio de Suspeita Device Fingerprint + Geolocalização Divergente',
      [Validators.required, Validators.minLength(3)]
    ],
    description: [
      'Detecta e encaminha para Análise Manual (REVISAR) pedidos onde o device fingerprint já foi registrado em outra conta de comprador E a geolocalização do pedido diverge do histórico habitual.'
    ],
    prdOrigin: [
      'PRD - Antifraude Device Fingerprint Geolocalização',
      Validators.required
    ],
    createdBy: ['Nexus AI Agent (Executivo)'],
    approvedBy: ['Comitê de Risco Equifax | Boa Vista'],
    storeId: ['ALL'],
    logic: ['AND'],
    action: ['REVIEW'],
    layer: ['1st'],
    priority: [6],
    ghostMode: [true],
    active: [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.ruleId.set(id);
    this.isEditMode.set(Boolean(id));

    if (id) {
      const existing = this.ruleService.getRuleById(id);
      if (existing) {
        this.form.patchValue({
          name: existing.name,
          description: existing.description,
          prdOrigin: existing.prdOrigin || 'PRD - Antifraude Device Fingerprint Geolocalização',
          createdBy: existing.createdBy || 'Nexus AI Agent (Executivo)',
          approvedBy: existing.approvedBy || 'Comitê de Risco Equifax | Boa Vista',
          storeId: existing.storeId,
          logic: existing.logic,
          action: existing.action,
          layer: existing.layer,
          priority: existing.priority,
          ghostMode: existing.ghostMode ?? existing.isGhostMode ?? true,
          active: existing.active,
        });
        this.selectedPayments.set([...existing.payments]);
        if (existing.clauses && existing.clauses.length > 0) {
          this.clauses.set([...existing.clauses]);
        }
        if (existing.auditTimestamp) {
          this.auditTimestamp.set(existing.auditTimestamp);
        }
      }
    }
  }

  hasPayment(method: PaymentMethod) {
    return this.selectedPayments().includes(method);
  }

  togglePayment(method: PaymentMethod) {
    const payments = this.selectedPayments();
    this.selectedPayments.set(
      payments.includes(method)
        ? payments.filter((item) => item !== method)
        : [...payments, method],
    );
  }

  setAction(action: RuleAction) {
    this.form.patchValue({ action });
  }

  addClauseFromSelect(parameterId: string) {
    this.clauseError.set(null);
    const paramObj = this.availableParameters().find(p => p.id === parameterId);
    if (!paramObj) return;

    // CT-DN2-05: Prevenção contra adição de cláusulas duplicadas no mesmo bloco
    const current = this.clauses();
    if (current.some(c => c.parameterId === parameterId)) {
      this.clauseError.set(`O parâmetro "${paramObj.name}" já foi adicionado a esta regra.`);
      return;
    }

    const newClause: RuleClause = {
      id: `clause-${Date.now().toString().slice(-4)}`,
      parameterId: paramObj.id,
      parameterName: paramObj.name,
      operator: paramObj.operators[0] || '==',
      value: paramObj.defaultValue ?? 'SIM'
    };

    this.clauses.set([...current, newClause]);
  }

  removeClause(clauseId: string) {
    this.clauseError.set(null);
    this.clauses.set(this.clauses().filter(c => c.id !== clauseId));
  }

  updateClauseOperator(clauseId: string, newOperator: string) {
    this.clauses.set(this.clauses().map(c => c.id === clauseId ? { ...c, operator: newOperator } : c));
  }

  updateClauseValue(clauseId: string, newValue: string) {
    this.clauseError.set(null);
    this.clauses.set(this.clauses().map(c => c.id === clauseId ? { ...c, value: newValue } : c));
  }

  getOperatorsForParam(parameterId: string): string[] {
    const p = this.availableParameters().find(item => item.id === parameterId);
    return p ? p.operators : ['==', '!='];
  }

  openImpactModal() {
    if (this.isSimulateDisabled()) {
      this.ruleService.showToast('Preencha os valores de todas as cláusulas antes de simular.', 'warning');
      return;
    }
    this.showImpactModal.set(true);
  }

  getRuleObjectForImpact(): Partial<Rule> {
    const value = this.form.getRawValue();
    return {
      id: this.ruleId() || 'rule-106',
      name: value.name || 'Nova Regra Antifraude',
      description: value.description || '',
      action: (value.action || 'REVIEW') as RuleAction,
      logic: (value.logic || 'AND') as RuleLogic,
      clauses: this.clauses(),
      ghostMode: value.ghostMode ?? true,
      prdOrigin: value.prdOrigin || 'PRD - Antifraude Device Fingerprint Geolocalização'
    };
  }

  save() {
    this.form.markAllAsTouched();
    this.clauseError.set(null);

    // CT-DN6-04 / CT-DN2-04: Bloqueio do salvamento com nome não informado ou campos vazios
    if (this.form.invalid) {
      this.ruleService.showToast('Preencha os campos obrigatórios (Nome da Regra e PRD de Origem).', 'warning');
      return;
    }

    const currentClauses = this.clauses();
    if (currentClauses.some(c => String(c.value).trim() === '')) {
      this.clauseError.set('Existe cláusula com o valor do parâmetro em branco. Preencha antes de salvar.');
      this.ruleService.showToast('Bloqueio: O valor da cláusula não pode ficar em branco.', 'warning');
      return;
    }

    const value = this.form.getRawValue();
    const isGhost = value.ghostMode ?? true;

    this.ruleService.saveRule({
      id: this.ruleId() === 'rule-106' ? undefined : (this.ruleId() ?? undefined),
      name: value.name!,
      description: value.description ?? '',
      storeId: value.storeId ?? 'ALL',
      storeName: 'Todas as Lojas',
      payments: this.selectedPayments(),
      logic: (value.logic ?? 'AND') as RuleLogic,
      action: (value.action ?? 'REVIEW') as RuleAction,
      layer: (value.layer ?? '1st') as RuleLayer,
      priority: value.priority ?? 6,
      ghostMode: isGhost,
      isGhostMode: isGhost,
      active: value.active ?? true,
      clauses: currentClauses,
      createdBy: value.createdBy || 'Nexus AI Agent (Executivo)',
      approvedBy: value.approvedBy || 'Comitê de Risco Equifax | Boa Vista',
      prdOrigin: value.prdOrigin || 'PRD - Antifraude Device Fingerprint Geolocalização',
      auditTimestamp: this.auditTimestamp()
    });

    this.router.navigate(['/regras']);
  }
}
