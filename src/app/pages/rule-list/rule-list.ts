import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Rule } from '../../models/rule.model';
import { RuleService } from '../../services/rule.service';
import { ImpactComponent } from '../impact/impact';

@Component({
  selector: 'app-rule-list',
  imports: [RouterLink, ImpactComponent],
  template: `
    <div class="rule-list-page">
      <nav class="breadcrumb">
        <span>Portal Antifraude</span><b>/</b><span>Engine de Risco</span><b>/</b>
        <span>Regras Globais e por Loja</span>
      </nav>

      <section class="title-row">
        <div>
          <h1>Gestão de Regras Antifraude</h1>
          <p>Gerencie regras, escopos, ações e Ghost Mode com visibilidade em tempo real.</p>
        </div>
        <div class="title-actions">
          <span class="live-pill">LIVE ENGINE</span>
          <a routerLink="/regras/nova" class="btn-primary">
            <span>＋</span> + Nova Regra Antifraude
          </a>

        </div>
      </section>

      <div class="scope-banner">
        <span class="scope-icon">◎</span>
        <strong>GLOBAL</strong>
        <span>Escopo: {{ selectedStoreLabel() }} (CMN 4.966 & LGPD Compliant)</span>
      </div>

      <!-- Recálculo Automático e Instantâneo dos KPIs (CT-DN1-02) -->
      <section class="metrics-grid">
        <article class="metric-card">
          <span class="metric-icon total">☷</span>
          <div>
            <strong>{{ totalRulesCount() }}</strong>
            <span>Total de Regras</span>
          </div>
          <em>100% visíveis</em>
        </article>
        <article class="metric-card">
          <span class="metric-icon active">✓</span>
          <div>
            <strong>{{ activeRulesCount() }}</strong>
            <span>Regras Ativas</span>
          </div>
          <em class="green">Em Produção</em>
        </article>
        <article class="metric-card">
          <span class="metric-icon global">▱</span>
          <div>
            <strong>{{ globalRulesCount() }}</strong>
            <span>Regras Globais</span>
          </div>
          <em class="blue">Todas as Lojas</em>
        </article>
        <article class="metric-card">
          <span class="metric-icon ghost">♙</span>
          <div>
            <strong>{{ ghostRulesCount() }}</strong>
            <span>Ghost Mode (A/B)</span>
          </div>
          <em class="amber">Modo Fantasma</em>
        </article>
      </section>

      <!-- Tabela da Tela /regras (CT-DN1-01) -->
      <section class="rules-table-card">
        @if (displayRules().length === 0) {
          <!-- Estado Vazio / Empty State (CT-DN1-04) -->
          <div class="empty-state-card">
            <div class="empty-icon">🔍</div>
            <h3>Nenhuma regra encontrada</h3>
            <p>Sua busca pelo termo "<b>{{ ruleService.searchQuery() }}</b>" não retornou resultados no escopo selecionado.</p>
            <button type="button" class="btn-secondary btn-sm" (click)="clearSearch()">Limpar Busca</button>

          </div>
        } @else {
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status / Escopo</th>
                  <th>Prio</th>
                  <th>Nome da Regra</th>
                  <th>Descrição / Objetivo</th>
                  <th>Camada</th>
                  <th>Ação Antifraude</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (rule of displayRules(); track rule.id) {
                  <tr>
                    <td>
                      <div class="status-scope">
                        <label class="switch" [title]="rule.active ? 'Desativar regra' : 'Ativar regra'">
                          <input type="checkbox" [checked]="rule.active" (change)="toggle(rule)" />
                          <span></span>
                        </label>
                        <span class="scope-badge" [class.store]="rule.storeId !== 'ALL'">
                          {{ rule.storeId === 'ALL' ? 'Global' : shortStore(rule) }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong class="priority">#0{{ rule.priority }}</strong>
                    </td>
                    <td>
                      <div class="name-cell">
                        <strong class="rule-name" [class.featured]="rule.id === 'rule-106'">
                          {{ rule.name }}
                        </strong>
                        @if (rule.ghostMode || rule.isGhostMode) {
                          <!-- Badge Visual Ghost Mode (CT-DN3-01) -->
                          <span class="ghost-mode-tag" title="Execução simulada em segundo plano sem impacto na decisão final">👻 GHOST</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="description">{{ compactDescription(rule) }}</span>
                    </td>
                    <td>
                      <strong class="layer">{{
                        rule.layer === '1st' ? '1ª Camada' : '2ª Camada'
                      }}</strong>
                    </td>
                    <td>
                      <span class="action" [class]="'action ' + rule.action.toLowerCase()">
                        {{ actionLabel(rule) }}
                      </span>
                    </td>
                    <td>
                      <div class="actions-row">
                        <button type="button" class="btn-secondary btn-sm" (click)="edit(rule)">Editar</button>
                        <button type="button" class="btn-secondary btn-sm" (click)="duplicate(rule.id)" title="Duplicar regra">📋</button>

                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <button type="button" class="floating-simulator" (click)="showImpactModal.set(true)">
        <span>ϟ</span> ⚡ Simulador em Tempo Real
      </button>

      @if (showImpactModal()) {
        <app-impact (close)="showImpactModal.set(false)" />
      }
    </div>
  `,
  styleUrl: './rule-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleListComponent {
  readonly ruleService = inject(RuleService);
  private readonly router = inject(Router);
  readonly showImpactModal = signal(false);

  readonly displayRules = computed(() => this.ruleService.filteredRules());

  readonly totalRulesCount = computed(() => this.displayRules().length);
  readonly activeRulesCount = computed(
    () => this.displayRules().filter((rule) => rule.active).length,
  );
  readonly globalRulesCount = computed(
    () => this.displayRules().filter((rule) => rule.storeId === 'ALL').length,
  );
  readonly ghostRulesCount = computed(
    () => this.displayRules().filter((rule) => rule.ghostMode || rule.isGhostMode).length,
  );

  readonly selectedStoreLabel = computed(() => {
    const storeObj = this.ruleService.currentStore();
    return storeObj.id === 'ALL' ? 'Regras Globais (Todas as Lojas)' : storeObj.name;
  });

  toggle(rule: Rule) {
    this.ruleService.toggleRuleStatus(rule.id);
  }

  edit(rule: Rule) {
    this.router.navigate(['/regras/editar', rule.id]);
  }

  duplicate(id: string) {
    this.ruleService.duplicateRule(id);
  }

  clearSearch() {
    this.ruleService.setSearchQuery('');
  }

  shortStore(rule: Rule): string {
    if (rule.storeId === 'store-1') return 'Loja 1';
    if (rule.storeId === 'store-2') return 'Loja 2';
    if (rule.storeId === 'store-3') return 'Loja 3';
    return rule.storeName || 'Loja';
  }

  compactDescription(rule: Rule): string {
    const desc = rule.description || 'Sem descrição cadastrada.';
    return desc.length > 90 ? desc.slice(0, 87) + '...' : desc;
  }

  actionLabel(rule: Rule): string {
    if (rule.action === 'APPROVE') return '✓ APROVAR';
    if (rule.action === 'REVIEW') return '🔍 REVISAR';
    if (rule.action === 'DECLINE') return '⛔ NEGAR';
    return rule.action;
  }
}
