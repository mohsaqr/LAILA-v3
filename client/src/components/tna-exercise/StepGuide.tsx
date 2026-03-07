/**
 * Educational guide content for each TNA Exercise step.
 * Text adapted from:
 *  - Saqr & López-Pernas (2026). "An Updated Comprehensive Tutorial on TNA"
 *  - Saqr, López-Pernas & Tikka (2025). "Mapping Relational Dynamics with TNA" (Ch. 15)
 */

interface StepGuideProps {
  step: number;
}

export const StepGuide = ({ step }: StepGuideProps) => {
  return (
    <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        {renderContent(step)}
      </div>
    </div>
  );
};

function renderContent(step: number) {
  switch (step) {
    case 0:
      return <DatasetGuide />;
    case 1:
      return <ViewDataGuide />;
    case 2:
      return <BuildModelGuide />;
    case 3:
      return <FrequenciesGuide />;
    case 4:
      return <TransitionsGuide />;
    case 5:
      return <NetworkGuide />;
    case 6:
      return <PruningGuide />;
    case 7:
      return <CentralityGuide />;
    case 8:
      return <PatternsGuide />;
    case 9:
      return <ClustersGuide />;
    default:
      return null;
  }
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-6 mb-2 first:mt-0">{children}</h3>
);

const SubTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-1.5">{children}</h4>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm leading-relaxed mb-3">{children}</p>
);

const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
);

function DatasetGuide() {
  return (
    <>
      <SectionTitle>What is Transition Network Analysis?</SectionTitle>
      <P>
        Transition Network Analysis (TNA) is a methodologically rigorous framework for modeling sequential processes as
        weighted directed networks. It combines the temporal resolution of stochastic process mining with the structural
        analytic capacity of graph theory.
      </P>
      <P>
        TNA can analyze any data that can be represented as a sequence with transitions or changes across time.
        In other words, TNA accepts any categorically ordered event data &mdash; sequences of learning events, states,
        phases, roles, dialogue moves, or interactions. This data can come from time-stamped learning management
        system data, coded interaction data, or event-log data.
      </P>

      <SectionTitle>What is sequence data?</SectionTitle>
      <P>
        TNA starts with <B>sequences</B> &mdash; ordered lists of actions, events, or states. Each sequence represents
        one person&rsquo;s journey through a process. For example, a student&rsquo;s learning session might produce:
      </P>
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2 mb-3 font-mono text-xs">
        login &rarr; view &rarr; view &rarr; quiz &rarr; submit &rarr; logout
      </div>
      <P>
        The datasets here contain <B>event logs</B> in tabular format: each row is a single event with an
        actor (who did it), an action (what happened), and a timestamp (when it happened). TNA groups events by
        actor, sorts them by time, and extracts the action column as the sequence of states.
      </P>

      <SectionTitle>Sample datasets</SectionTitle>
      <P>
        We provide three pre-loaded example datasets to explore different domains:
      </P>
      <ul className="list-disc list-inside text-sm space-y-1 mb-3">
        <li><B>Online Learning</B> &mdash; 200 students navigating an LMS (login, view, quiz, submit, download, forum, reply, logout)</li>
        <li><B>Social Media</B> &mdash; 250 users interacting on a platform (scroll, like, comment, share, post, search, follow)</li>
        <li><B>Game Actions</B> &mdash; 200 players in an RPG (explore, fight, loot, craft, trade, rest, quest)</li>
      </ul>
      <P>
        Pick one to begin &mdash; you can always come back and try a different dataset.
      </P>
    </>
  );
}

function ViewDataGuide() {
  return (
    <>
      <SectionTitle>Understanding your data</SectionTitle>
      <P>
        Before building any model, it is essential to inspect and understand the raw data. The table above shows every
        event in the dataset. Each row is a single event: an action performed by an actor at a specific point in time.
      </P>

      <SectionTitle>Assigning column roles</SectionTitle>
      <P>
        TNA needs to know three things about your data:
      </P>
      <ul className="list-none space-y-2 mb-3 text-sm">
        <li className="flex gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
          <span><B>Actor</B> (who did it) &mdash; The column identifying who performed the action: a student ID, user ID,
          or player ID. When you include an actor, TNA creates one sequence per actor instead of treating everything as
          one stream. Without it, the last event of one person transitions directly into the first event of the next,
          which makes no sense.</span>
        </li>
        <li className="flex gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
          <span><B>Action</B> (what happened) &mdash; The column containing the events, states, or behaviors you want to
          model. These become the <B>nodes</B> in your network. Things like &ldquo;login&rdquo;, &ldquo;view&rdquo;,
          &ldquo;quiz&rdquo;, or &ldquo;submit&rdquo;.</span>
        </li>
        <li className="flex gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
          <span><B>Time</B> (when it happened) &mdash; The timestamp column. This ensures events are sorted in the right
          order within each actor. Even if your data rows are shuffled, TNA will sort by this column.</span>
        </li>
      </ul>

      <SectionTitle>How sequences are built</SectionTitle>
      <P>
        Once you assign columns, TNA groups all events by <B>actor</B>, sorts them by <B>time</B>, and extracts
        the <B>action</B> column as a sequence. For example, if Alice has events: login (8:00), view (8:05),
        quiz (8:35), submit (8:50), her sequence becomes: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">login &rarr; view &rarr; quiz &rarr; submit</code>.
      </P>
      <P>
        The <B>state chips</B> above the table show all unique actions discovered in your data. These are the states
        (nodes) that will appear in the transition network. The number of sequences equals the number of unique actors,
        and each sequence must have at least 2 events to produce a transition.
      </P>
    </>
  );
}

function BuildModelGuide() {
  return (
    <>
      <SectionTitle>Building a TNA model</SectionTitle>
      <P>
        A TNA model estimates a first-order Markov transition probability matrix from the sequences, along with initial
        state probabilities. This single model object is used by all subsequent analysis and visualization steps.
      </P>
      <P>
        Since its introduction, TNA now supports <B>multiple model types</B> &mdash; each suited to different data
        characteristics and research questions:
      </P>

      <SubTitle>Relative (TNA)</SubTitle>
      <P>
        The standard model. Each cell in the transition matrix represents the <B>probability</B> of transitioning from
        state <em>i</em> to state <em>j</em>. Rows are normalized so each sums to 1. For example, a value of 0.60 from
        &ldquo;Watch Video&rdquo; to &ldquo;Quiz&rdquo; means there is a 60% probability that students proceed to take
        the quiz after watching the video. This is the most common model type and is appropriate when you want to
        understand the likelihood of each transition.
      </P>

      <SubTitle>Frequency (fTNA)</SubTitle>
      <P>
        Raw transition counts without normalization. Shows <B>how many times</B> each transition occurred in the data.
        This is useful when you care about absolute frequencies rather than proportions &mdash; for example, to identify
        the most common transitions overall, not just the most probable ones from each state.
      </P>

      <SubTitle>Co-occurrence (cTNA)</SubTitle>
      <P>
        Captures which states tend to <B>appear together</B> within the same sequences, regardless of their order. Unlike
        the relative model which tracks A&rarr;B transitions, co-occurrence captures that A and B tend to co-exist in the
        same behavioral sequence. This is useful for understanding which behaviors cluster together.
      </P>

      <SubTitle>Attention (aTNA)</SubTitle>
      <P>
        Attention-weighted transitions that give <B>more weight to transitions that are distinctive</B> to specific
        sequences. If a transition appears uniformly across all sequences, it receives less weight. If it appears
        concentrated in certain sequences, it receives more. This helps identify transitions that characterize particular
        behavioral patterns rather than universal tendencies.
      </P>
    </>
  );
}

function FrequenciesGuide() {
  return (
    <>
      <SectionTitle>State frequency analysis</SectionTitle>
      <P>
        Before building a network, it is useful to check which states dominate your data. The <B>frequency chart</B> shows
        how often each state appears across all sequences &mdash; raw frequency, not transition probability. This gives
        you a first look at the distribution of behaviors.
      </P>
      <P>
        A state with very high frequency is a common behavior that students engage in often. A state with low frequency
        is rare and may represent a specialized action. Understanding these frequencies helps contextualize the
        transitions you&rsquo;ll see later &mdash; a strong transition from a rare state has a different meaning than the
        same transition from a common state.
      </P>

      <SectionTitle>Distribution over time</SectionTitle>
      <P>
        The <B>distribution plot</B> aggregates across all sequences and shows, at each position (timestep), the
        proportion of sequences in each state. This reveals temporal patterns: which states tend to appear at the
        beginning of sequences, which appear at the end, and how the mix shifts over time.
      </P>
      <P>
        For example, you might see &ldquo;login&rdquo; dominating position 1, &ldquo;view&rdquo; appearing in the middle,
        and &ldquo;logout&rdquo; at the end. These patterns show the typical progression through the learning process and
        can highlight whether certain behaviors are phase-specific or spread throughout.
      </P>
    </>
  );
}

function TransitionsGuide() {
  return (
    <>
      <SectionTitle>The transition matrix</SectionTitle>
      <P>
        The transition matrix is the mathematical core of TNA. It is a square matrix where each element [<em>i</em>,&nbsp;<em>j</em>]
        represents the weight of the transition from state <em>i</em> (row) to state <em>j</em> (column). In other words,
        each row tells you: <B>&ldquo;Given that the learner is currently in this state, what happens next?&rdquo;</B>
      </P>

      <SubTitle>How to read the matrix</SubTitle>
      <P>
        Each <B>row</B> represents a source state (where you are now). Each <B>column</B> represents a destination state
        (where you go next). A cell value tells you the strength of that transition. For the probability model, each row
        sums to 1 &mdash; covering all possible next steps from that state.
      </P>
      <P>
        For example, if the cell at row &ldquo;view&rdquo; and column &ldquo;quiz&rdquo; shows 0.35, it means there is a
        35% probability of moving from viewing content to taking a quiz. A value of 0.00 means that transition never
        occurred in the data.
      </P>

      <SubTitle>Raw counts vs. probabilities</SubTitle>
      <P>
        You can toggle between two views:
      </P>
      <ul className="list-disc list-inside text-sm space-y-1 mb-3">
        <li><B>Probabilities</B> (row-normalized) &mdash; Each row sums to 1. Shows the <em>likelihood</em> of each transition. Best for understanding behavioral patterns.</li>
        <li><B>Raw Counts</B> (frequency) &mdash; Absolute number of times each transition was observed. Best for understanding which transitions are most common overall.</li>
      </ul>
      <P>
        The color intensity of each cell reflects the magnitude of the value &mdash; darker cells indicate stronger transitions.
        Hover over any cell to see the exact value with full precision.
      </P>

      <SubTitle>Diagonal values (self-transitions)</SubTitle>
      <P>
        Values on the diagonal (where row = column) represent <B>self-transitions</B> &mdash; the probability of staying
        in the same state or repeating the same event. A high diagonal value like 0.37 for &ldquo;plan&rdquo; means
        students often plan multiple times in a row. Self-transitions can indicate persistence, repetition, or being
        &ldquo;stuck&rdquo; in a particular state.
      </P>
    </>
  );
}

function NetworkGuide() {
  return (
    <>
      <SectionTitle>The transition network</SectionTitle>
      <P>
        The network visualization is the core representation of TNA. Each <B>state becomes a node</B> (circle), and
        each <B>transition becomes a directed edge</B> (arrow). The thickness and opacity of each arrow reflects the
        transition weight &mdash; thicker, more opaque arrows represent stronger transitions.
      </P>
      <P>
        In the learning process context, the network captures the full structure of how students navigate through
        different activities: which transitions are most probable, which activities are central, and how they are
        temporally related.
      </P>

      <SubTitle>Reading the network</SubTitle>
      <ul className="list-disc list-inside text-sm space-y-1.5 mb-3">
        <li><B>Nodes</B> (circles) represent the different states &mdash; learning events, actions, or behaviors</li>
        <li><B>Arrows</B> show the direction of transitions, from one state to the next</li>
        <li><B>Arrow thickness</B> reflects the transition weight &mdash; thicker means more probable or more frequent</li>
        <li><B>Edge labels</B> show the exact transition value when enabled</li>
        <li><B>Self-loops</B> (arrows from a node to itself) show the probability of repeating the same state</li>
      </ul>

      <SubTitle>Model type controls</SubTitle>
      <P>
        You can switch between different model types to see how the network changes:
      </P>
      <ul className="list-disc list-inside text-sm space-y-1 mb-3">
        <li><B>Relative</B> &mdash; Transition probabilities (rows sum to 1)</li>
        <li><B>Frequency</B> &mdash; Raw transition counts</li>
        <li><B>Co-occurrence</B> &mdash; Which states appear together in sequences</li>
        <li><B>Attention</B> &mdash; Transitions weighted by distinctiveness</li>
      </ul>
      <P>
        Try toggling <B>self-loops</B> on to see which states tend to repeat. Adjust the <B>node size</B> slider to
        make the visualization more readable. <B>Edge labels</B> can be turned off for a cleaner look when you just
        want to see the overall structure.
      </P>
    </>
  );
}

function CentralityGuide() {
  return (
    <>
      <SectionTitle>What is centrality?</SectionTitle>
      <P>
        Centrality measures reduce each state to a single number capturing its <B>structural importance</B> in the
        network. Different measures answer different questions about what makes a state &ldquo;important.&rdquo;
        With centrality, researchers can rank events and identify which behaviors or states are central to the
        process &mdash; either as frequent destinations, common origins, or bridges between different parts.
      </P>

      <SubTitle>InStrength (incoming weight)</SubTitle>
      <P>
        InStrength is the sum of all <B>incoming</B> edge weights for a node. It measures how much &ldquo;flow&rdquo;
        enters a state &mdash; making it an indicator of a state&rsquo;s role as an <B>attractor</B> or popular
        destination in the process. A state with high InStrength is where the process frequently converges.
      </P>
      <P>
        For example, if &ldquo;consensus&rdquo; has the highest InStrength, it means many other states lead into
        consensus &mdash; it is a major destination in the learning process.
      </P>

      <SubTitle>Betweenness (bridge role)</SubTitle>
      <P>
        Betweenness centrality measures how often a node lies on the <B>shortest paths</B> between other nodes. A state
        with high betweenness serves as a <B>bridge or bottleneck</B> &mdash; it connects different parts of the process.
        Removing such a state would significantly disrupt the flow between other states.
      </P>
      <P>
        For example, if &ldquo;discuss&rdquo; has high betweenness, it acts as a gateway connecting different behavioral
        clusters. Students pass through discussion on their way between planning and execution, making it structurally
        critical even if its individual transition weights are moderate.
      </P>

      <SubTitle>Interpreting centrality</SubTitle>
      <P>
        In TNA, it is the <B>relative values</B> of centrality measures that matter most, not the absolute numbers.
        The comparison between nodes helps determine which events are central, which serve as key bridges, and which
        are the most common destinations. The network on the left shows nodes <B>sized by your chosen centrality
        measure</B> &mdash; larger nodes are more central. The bar chart and table on the right provide the exact values
        for comparison.
      </P>
    </>
  );
}

function PruningGuide() {
  return (
    <>
      <SectionTitle>Why prune?</SectionTitle>
      <P>
        A transition probability matrix is almost always <B>fully connected</B> &mdash; every state has some nonzero
        probability of transitioning to every other state. This makes the raw network dense and hard to read. Pruning
        removes weak edges so only the <B>backbone</B> remains, making the network more interpretable.
      </P>
      <P>
        Pruning is purely for <B>visualization and interpretation</B>. It does not affect the underlying model or any
        analytical results. All edges are retained internally regardless of pruning. Its purpose is to remove weak
        connections that contribute visual clutter without carrying substantive meaning.
      </P>

      <SubTitle>The threshold</SubTitle>
      <P>
        The prune threshold controls which edges are removed. Edges with weight <B>below the threshold</B> are deleted.
        For example, a threshold of 0.10 removes all transitions with probability less than 10%.
      </P>
      <ul className="list-disc list-inside text-sm space-y-1 mb-3">
        <li><B>Low threshold (0.01&ndash;0.05)</B> &mdash; Removes only very weak edges. Network stays dense but slightly cleaner.</li>
        <li><B>Medium threshold (0.05&ndash;0.15)</B> &mdash; Good balance. Removes noise while keeping meaningful transitions.</li>
        <li><B>High threshold (0.15&ndash;0.50)</B> &mdash; Aggressive pruning. Only the strongest backbone remains.</li>
      </ul>
      <P>
        Use the slider to adjust the threshold and watch the network change in real time. The edge counts above
        show how many edges are retained vs. removed. Compare the <B>original network</B> (left) with the
        <B> pruned network</B> (right) to see which connections form the true backbone of the process.
      </P>

      <SubTitle>Choosing the right threshold</SubTitle>
      <P>
        There is no single &ldquo;correct&rdquo; threshold &mdash; it depends on your research goals. For exploratory
        analysis, start with a moderate threshold (0.05&ndash;0.10) and adjust. If you want to identify only the
        strongest behavioral patterns, increase it. If you need a complete picture, keep it low. In research contexts,
        more principled methods like the <B>disparity filter</B> or <B>bootstrap pruning</B> can be used to
        statistically determine which edges are significant.
      </P>
    </>
  );
}

function PatternsGuide() {
  return (
    <>
      <SectionTitle>Patterns and cliques</SectionTitle>
      <P>
        Patterns represent the fundamental building blocks of the structure and dynamics of the learning process. They
        provide insights into the behavior and strategies that learners use while studying or interacting with learning
        materials. Capturing repeated, consistent patterns allows us to build theories and generalizable inferences.
      </P>
      <P>
        A <B>clique</B> is a fully connected subnetwork where every state has strong mutual transitions to every other
        state in the group. Cliques reveal <B>self-reinforcing behavioral loops</B> &mdash; once a learner enters a
        clique, the transition probabilities keep them cycling within it.
      </P>

      <SubTitle>Dyads (size 2)</SubTitle>
      <P>
        A dyad is the simplest pattern: a <B>mutual transition between two states</B> where both directions have
        strong weights. Strong mutual dyads indicate that two states are strongly interdependent and recurrently
        co-occurring. For example, consistently moving from &ldquo;read&rdquo; to &ldquo;quiz&rdquo; and back indicates
        a self-evaluative study strategy.
      </P>

      <SubTitle>Triads (size 3)</SubTitle>
      <P>
        Triads represent connections between three states, capturing <B>higher-order dependencies</B> where one activity
        not only follows another but influences subsequent events. For example, a triad among &ldquo;plan&rdquo;,
        &ldquo;monitor&rdquo;, and &ldquo;adapt&rdquo; may indicate an effective self-regulation cycle. Triads are
        particularly important because they can highlight reciprocal or reinforcing relationships forming a cohesive
        structure.
      </P>

      <SubTitle>Interpreting patterns</SubTitle>
      <P>
        The patterns shown above are discovered from your data with different minimum sizes. A pattern among regulatory
        states may indicate effective learning strategies, while patterns among social states may indicate off-task loops.
        The threshold for each pattern size decreases as the size increases, because fully mutual connections among more
        states become increasingly unlikely.
      </P>
    </>
  );
}

function ClustersGuide() {
  return (
    <>
      <SectionTitle>Communities and clusters</SectionTitle>
      <P>
        Communities are groups of states that are more <B>densely connected to each other</B> than to the rest of the
        network. They reveal the modular structure and functional subsystems within the transition network.
      </P>
      <P>
        Unlike cliques (which require every pair to be mutually connected), community detection uses <B>modularity-based
        algorithms</B> to reveal existing structures. Communities are not strictly fully connected but show
        higher-than-average connectivity &mdash; the grouping indicates a higher level of association and interaction
        compared to the broader network.
      </P>

      <SubTitle>What clusters reveal</SubTitle>
      <P>
        In the context of learning analytics, communities can be groups of dialogue moves, learning events, or states
        that follow each other more frequently. Identifying communities helps uncover <B>latent clusters of related
        behaviors</B> &mdash; for example, how learners collaborate, self-regulate, or approach their learning.
      </P>
      <P>
        Think of identifying communities as uncovering latent variables. These communities represent underlying patterns
        of interaction inferred from densely connected behaviors, suggesting the presence of an underlying behavioral
        mechanism. This data-driven approach helps provide evidence for existing constructs, validate theories, or
        discover new behavioral dynamics.
      </P>

      <SubTitle>Sequence clustering</SubTitle>
      <P>
        While community detection groups <B>states</B> (nodes), sequence clustering groups <B>sequences</B> (people).
        Clusters represent typical transition networks that recur together &mdash; groups of learners who exhibit
        similar behavioral patterns. Each cluster has its own distinct transition probabilities, revealing different
        <B> learner archetypes</B> or strategies.
      </P>
      <P>
        The number of clusters (<em>k</em>) determines how many groups to find. Try different values to see how the
        groupings change. Fewer clusters give broader categories; more clusters reveal finer distinctions between
        behavioral approaches.
      </P>
    </>
  );
}
