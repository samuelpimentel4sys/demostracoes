import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RuleService } from '../../services/rule.service';
import { PaymentMethod, TransactionSimulation, SimulationResult } from '../../models/rule.model';

@Component({
  selector: 'app-simulator',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="simulator-backdrop" (click)="close()">
      <div class="simulator-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="title-wrapper">
            <div>
              <h2>Simulador Antifraude em Tempo Real</h2>
              <p>Validação instantânea de regras, ordenamento de prioridade e Ghost Mode (A/B Test)</p>
            </div>
          </div>
          <button class="close-btn" (click)="close()" title="Fechar simulador">✕</button>
        </div>

        <div class="modal-body">
          <div class="simulator-layout">
            <!-- Left Panel: Transaction Inputs -->
            <div class="sim-inputs-panel">
              <h3 class="panel-title">Atributos do Pedido</h3>

              <div class="sim-form-grid">
                <div class="form-group">
                  <label>Loja de Origem</label>
                  <select class="form-control" [(ngModel)]="storeId" (change)="runSimulation()">
                    @for (store of ruleService.stores(); track store.id) {
                      <option [value]="store.id">{{ store.name }}</option>
                    }
                  </select>
                </div>

                <div class="form-group">
                  <label>Meio de Pagamento</label>
                  <select class="form-control" [(ngModel)]="paymentMethod" (change)="runSimulation()">
                    <option value="cartao">Cartão de Crédito</option>
                    <option value="pix">PIX / EAD</option>
                    <option value="voucher">Voucher</option>
                    <option value="boleto">Boleto Bancário</option>
                  </select>
                </div>


                <div class="form-group">
                  <label>Valor do Pedido (R$)</label>
                  <input type="number" class="form-control" [(ngModel)]="orderValue" (input)="runSimulation()" placeholder="2500" />
                </div>

                <div class="form-group">
                  <label>Parcelas</label>
                  <input type="number" class="form-control" [(ngModel)]="installments" (input)="runSimulation()" placeholder="12" />
                </div>

                <div class="form-group">
                  <label>BIN do Cartão (6 dígitos)</label>
                  <input type="text" class="form-control" [(ngModel)]="cardBin" (input)="runSimulation()" placeholder="453211" />
                </div>

                <div class="form-group">
                  <label>País Emissor x Entrega</label>
                  <select class="form-control" [(ngModel)]="sameCountryDelivery" (change)="runSimulation()">
                    <option value="Diferentes">Diferentes (Suspeito)</option>
                    <option value="Iguais">Iguais (Mesmo País)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>E-mail Comprador</label>
                  <input type="text" class="form-control" [(ngModel)]="customerEmail" (input)="runSimulation()" placeholder="compra.suspeita@tempmail.com" />
                </div>

                <div class="form-group">
                  <label>Tentativas Pagamento (24h)</label>
                  <input type="number" class="form-control" [(ngModel)]="attempts24h" (input)="runSimulation()" placeholder="4" />
                </div>

                <div class="form-group">
                  <label>% Pago via Voucher</label>
                  <input type="number" class="form-control" [(ngModel)]="voucherPercent" (input)="runSimulation()" placeholder="60" />
                </div>

                <div class="form-group">
                  <label>Score de Risco AI (0-100)</label>
                  <input type="number" class="form-control" [(ngModel)]="riskScore" (input)="runSimulation()" placeholder="85" />
                </div>

                <div class="form-group">
                  <label>Device Fingerprint em Outra Conta</label>
                  <select class="form-control" [(ngModel)]="deviceFingerprintSeenInOtherAccount" (change)="runSimulation()">
                    <option value="SIM">SIM (Visto em conta diferente)</option>
                    <option value="NÃO">NÃO (Apenas nesta conta)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Geolocalização Divergente</label>
                  <select class="form-control" [(ngModel)]="geoLocDivergent" (change)="runSimulation()">
                    <option value="SIM">SIM (Diverge do histórico)</option>
                    <option value="NÃO">NÃO (Dentro do padrão habitual)</option>
                  </select>
                </div>
              </div>
            </div>


            <!-- Right Panel: Simulation Evaluation Results -->
            <div class="results-panel">
              <h3 class="panel-title">Resultado da Avaliação Core</h3>

              <div class="decision-card" [class]="'decision-' + result().finalDecision.toLowerCase()">
                <span class="decision-label">Decisão Antifraude Emitida</span>
                <div class="decision-status">
                  @switch (result().finalDecision) {
                    @case ('APPROVE') {
                      <span class="badge-status approve">APROVAR (TRANSAÇÃO LIBERADA)</span>
                    }
                    @case ('REVIEW') {
                      <span class="badge-status review">REVISAR (ANÁLISE MANUAL REQUERIDA)</span>
                    }
                    @case ('DECLINE') {
                      <span class="badge-status decline">NEGAR (BLOQUEIO DE SEGURANÇA)</span>
                    }
                    @default {
                      <span class="badge-status neutral">NENHUMA REGRA DISPARADA (FLUXO PADRÃO)</span>
                    }
                  }
                </div>
                <p class="explanation-text">{{ result().explanation }}</p>
              </div>

              <!-- Matched Rules List -->
              <div class="matched-section">
                <div class="section-subhead">
                  <h4>Regras Ativas Disparadas ({{ result().matchedRules.length }})</h4>
                </div>

                @if (result().matchedRules.length > 0) {
                  <div class="rule-match-list">
                    @for (m of result().matchedRules; track m.rule.id) {
                      <div class="rule-match-card">
                        <div class="match-header">
                          <span class="priority-tag">#{{ m.rule.priority }}</span>
                          <strong class="rule-title">{{ m.rule.name }}</strong>
                          <span class="action-tag" [class]="'action-' + m.rule.action.toLowerCase()">
                            {{ m.rule.action }}
                          </span>
                        </div>
                        <p class="match-desc">{{ m.rule.description }}</p>
                        <div class="clause-proofs">
                          @for (cr of m.clauseResults; track cr.clause.id) {
                            <span class="proof-badge" [class.passed]="cr.passed">
                              {{ cr.clause.parameterName }} {{ cr.clause.operator }} "{{ cr.clause.value }}"
                            </span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="no-matches">
                    <span>Nenhuma regra ativa correspondeu aos critérios informados.</span>
                  </div>
                }
              </div>

              <!-- Ghost Mode Rules Triggered -->
              @if (result().ghostRulesTriggered.length > 0) {
                <div class="ghost-section">
                  <div class="section-subhead">
                    <h4>Regras em Ghost Mode Disparadas ({{ result().ghostRulesTriggered.length }})</h4>
                  </div>

                  <p class="ghost-hint">Regras simuladas em segundo plano para validação A/B sem impacto na transação real.</p>

                  <div class="rule-match-list">
                    @for (g of result().ghostRulesTriggered; track g.rule.id) {
                      <div class="rule-match-card ghost">
                        <div class="match-header">
                          <span class="priority-tag">#{{ g.rule.priority }}</span>
                          <strong class="rule-title">{{ g.rule.name }}</strong>
                          <span class="ghost-badge">GHOST MODE</span>
                        </div>
                        <p class="match-desc">{{ g.rule.description }}</p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-eq-secondary" (click)="resetFields()">Limpar Dados do Teste</button>
          <button class="btn-eq-primary" (click)="close()">Concluir Simulação</button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './simulator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulatorComponent {
  readonly ruleService = inject(RuleService);

  storeId = 'ALL';
  paymentMethod: PaymentMethod = 'cartao';
  orderValue = 2500;
  installments = 12;
  cardBin = '453211';
  cardCountry = 'BRASIL';
  voucherPercent = 60;
  sameCountryDelivery = 'Diferentes';
  customerEmail = 'compra.suspeita@tempmail.com';
  attempts24h = 4;
  riskScore = 85;
  deviceFingerprintSeenInOtherAccount = 'SIM';
  geoLocDivergent = 'SIM';


  readonly result = signal<SimulationResult>({
    finalDecision: 'NEUTRAL',
    matchedRules: [],
    ghostRulesTriggered: [],
    explanation: ''
  });

  ngOnInit() {
    this.runSimulation();
  }

  runSimulation() {
    const transaction: TransactionSimulation = {
      storeId: this.storeId,
      paymentMethod: this.paymentMethod,
      orderValue: Number(this.orderValue) || 0,
      installments: Number(this.installments) || 1,
      cardBin: this.cardBin || '',
      cardCountry: this.cardCountry || 'BRASIL',
      voucherPercent: Number(this.voucherPercent) || 0,
      sameCountryDelivery: this.sameCountryDelivery,
      customerEmail: this.customerEmail || '',
      attempts24h: Number(this.attempts24h) || 0,
      riskScore: Number(this.riskScore) || 0,
      deviceFingerprintSeenInOtherAccount: this.deviceFingerprintSeenInOtherAccount,
      geoLocDivergent: this.geoLocDivergent
    };


    const simRes = this.ruleService.evaluateTransaction(transaction);
    this.result.set(simRes);
  }

  resetFields() {
    this.storeId = 'ALL';
    this.paymentMethod = 'cartao';
    this.orderValue = 1000;
    this.installments = 3;
    this.cardBin = '400000';
    this.cardCountry = 'BRASIL';
    this.voucherPercent = 0;
    this.sameCountryDelivery = 'Iguais';
    this.customerEmail = 'cliente.normal@gmail.com';
    this.attempts24h = 1;
    this.riskScore = 15;
    this.deviceFingerprintSeenInOtherAccount = 'NÃO';
    this.geoLocDivergent = 'NÃO';
    this.runSimulation();

  }

  close() {
    const parentComp = (window as any).appHeaderInstance;
    if (parentComp && parentComp.showSimulator) {
      parentComp.showSimulator.set(false);
    }
  }
}
