/**
 * Educational guide content for each SNA Exercise analysis tab.
 * Modelled on the TNA StepGuide — same component structure and visual style.
 *
 * Text covers graph-level metrics, centrality, community detection,
 * and adjacency matrix interpretation — written at undergraduate level.
 *
 * All text is externalised to i18n keys under the `courses` namespace
 * using the prefix `sna.sg_*`.
 */

import { useTranslation } from 'react-i18next';

type SnaAnalysisKey = 'metrics' | 'centrality' | 'communities' | 'adjacency';

interface SnaStepGuideProps {
  step: SnaAnalysisKey;
}

export const SnaStepGuide = ({ step }: SnaStepGuideProps) => {
  return (
    <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        <GuideContent step={step} />
      </div>
    </div>
  );
};

function GuideContent({ step }: { step: SnaAnalysisKey }) {
  switch (step) {
    case 'metrics':
      return <MetricsGuide />;
    case 'centrality':
      return <CentralityGuide />;
    case 'communities':
      return <CommunitiesGuide />;
    case 'adjacency':
      return <AdjacencyGuide />;
    default:
      return null;
  }
}

/* ─── Utility components ─── */

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-6 mb-2 first:mt-0">{children}</h3>
);

const SubTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-1.5">{children}</h4>
);

/** Paragraph that renders HTML (for <strong> tags inside translated strings). */
const P = ({ html }: { html: string }) => (
  <p
    className="text-sm leading-relaxed mb-3"
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

/** List item that renders HTML. */
const Li = ({ html }: { html: string }) => (
  <li
    className="text-sm"
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

/* ─── Section components ─── */

function MetricsGuide() {
  const { t } = useTranslation('courses');
  return (
    <>
      <SectionTitle>{t('sna.sg_metrics_title')}</SectionTitle>
      <P html={t('sna.sg_metrics_p1')} />
      <P html={t('sna.sg_metrics_p2')} />

      <SubTitle>{t('sna.sg_metrics_density_title')}</SubTitle>
      <P html={t('sna.sg_metrics_density_p1')} />
      <P html={t('sna.sg_metrics_density_p2')} />

      <SubTitle>{t('sna.sg_metrics_avgdeg_title')}</SubTitle>
      <P html={t('sna.sg_metrics_avgdeg_p1')} />

      <SubTitle>{t('sna.sg_metrics_recip_title')}</SubTitle>
      <P html={t('sna.sg_metrics_recip_p1')} />
      <P html={t('sna.sg_metrics_recip_p2')} />

      <SubTitle>{t('sna.sg_metrics_avgw_title')}</SubTitle>
      <P html={t('sna.sg_metrics_avgw_p1')} />
    </>
  );
}

function CentralityGuide() {
  const { t } = useTranslation('courses');
  return (
    <>
      <SectionTitle>{t('sna.sg_cent_title')}</SectionTitle>
      <P html={t('sna.sg_cent_p1')} />
      <P html={t('sna.sg_cent_p2')} />

      <SubTitle>{t('sna.sg_cent_degree_title')}</SubTitle>
      <P html={t('sna.sg_cent_degree_p1')} />
      <P html={t('sna.sg_cent_degree_p2')} />

      <SubTitle>{t('sna.sg_cent_strength_title')}</SubTitle>
      <P html={t('sna.sg_cent_strength_p1')} />
      <P html={t('sna.sg_cent_strength_p2')} />

      <SubTitle>{t('sna.sg_cent_between_title')}</SubTitle>
      <P html={t('sna.sg_cent_between_p1')} />
      <P html={t('sna.sg_cent_between_p2')} />

      <SubTitle>{t('sna.sg_cent_close_title')}</SubTitle>
      <P html={t('sna.sg_cent_close_p1')} />
      <P html={t('sna.sg_cent_close_p2')} />

      <SubTitle>{t('sna.sg_cent_interpret_title')}</SubTitle>
      <P html={t('sna.sg_cent_interpret_p1')} />
    </>
  );
}

function CommunitiesGuide() {
  const { t } = useTranslation('courses');
  return (
    <>
      <SectionTitle>{t('sna.sg_comm_title')}</SectionTitle>
      <P html={t('sna.sg_comm_p1')} />
      <P html={t('sna.sg_comm_p2')} />

      <SubTitle>{t('sna.sg_comm_label_title')}</SubTitle>
      <P html={t('sna.sg_comm_label_p1')} />
      <P html={t('sna.sg_comm_label_p2')} />

      <SubTitle>{t('sna.sg_comm_mod_title')}</SubTitle>
      <P html={t('sna.sg_comm_mod_p1')} />

      <SubTitle>{t('sna.sg_comm_walk_title')}</SubTitle>
      <P html={t('sna.sg_comm_walk_p1')} />

      <SubTitle>{t('sna.sg_comm_spectral_title')}</SubTitle>
      <P html={t('sna.sg_comm_spectral_p1')} />

      <SubTitle>{t('sna.sg_comm_interpret_title')}</SubTitle>
      <P html={t('sna.sg_comm_interpret_p1')} />
    </>
  );
}

function AdjacencyGuide() {
  const { t } = useTranslation('courses');
  return (
    <>
      <SectionTitle>{t('sna.sg_adj_title')}</SectionTitle>
      <P html={t('sna.sg_adj_p1')} />
      <P html={t('sna.sg_adj_p2')} />

      <SubTitle>{t('sna.sg_adj_dir_title')}</SubTitle>
      <P html={t('sna.sg_adj_dir_p1')} />
      <P html={t('sna.sg_adj_dir_p2')} />

      <SubTitle>{t('sna.sg_adj_heatmap_title')}</SubTitle>
      <P html={t('sna.sg_adj_heatmap_p1')} />
      <ul className="list-disc list-inside text-sm space-y-1.5 mb-3">
        <Li html={t('sna.sg_adj_heatmap_li_dark_rows')} />
        <Li html={t('sna.sg_adj_heatmap_li_dark_cols')} />
        <Li html={t('sna.sg_adj_heatmap_li_blocks')} />
        <Li html={t('sna.sg_adj_heatmap_li_diagonal')} />
        <Li html={t('sna.sg_adj_heatmap_li_sparse')} />
      </ul>

      <SubTitle>{t('sna.sg_adj_ops_title')}</SubTitle>
      <P html={t('sna.sg_adj_ops_p1')} />
      <P html={t('sna.sg_adj_ops_p2')} />
    </>
  );
}
