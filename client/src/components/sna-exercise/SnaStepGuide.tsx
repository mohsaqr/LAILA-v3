/**
 * Educational guide content for each SNA Exercise analysis tab.
 * Modelled on the TNA StepGuide — same component structure and visual style.
 *
 * Text covers graph-level metrics, centrality, community detection,
 * and adjacency matrix interpretation — written at undergraduate level.
 */

type SnaAnalysisKey = 'metrics' | 'centrality' | 'communities' | 'adjacency';

interface SnaStepGuideProps {
  step: SnaAnalysisKey;
}

export const SnaStepGuide = ({ step }: SnaStepGuideProps) => {
  return (
    <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        {renderContent(step)}
      </div>
    </div>
  );
};

function renderContent(step: SnaAnalysisKey) {
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

function MetricsGuide() {
  return (
    <>
      <SectionTitle>What are graph-level metrics?</SectionTitle>
      <P>
        Graph-level metrics summarise the <B>overall structure</B> of a network in a single number. Rather than
        describing one node or one edge, they capture a property of the whole network &mdash; how connected it is, how
        information might spread, or how many mutual relationships exist. These are typically the first things researchers
        report when describing a social network.
      </P>
      <P>
        Think of graph metrics as the &ldquo;vital signs&rdquo; of a network. Just as a doctor checks pulse and
        temperature before diving deeper, a network analyst checks density and degree before interpreting centrality or
        communities.
      </P>

      <SubTitle>Density</SubTitle>
      <P>
        Density is the ratio of actual edges to the maximum possible number of edges. A density of 1.0 means every node
        is connected to every other node (a complete graph). A density of 0.0 means no connections at all. Most real
        social networks are <B>sparse</B> &mdash; density values between 0.05 and 0.25 are common.
      </P>
      <P>
        High-density networks tend to be cohesive and redundant &mdash; information spreads quickly and there are many
        alternative paths. Low-density networks are more efficient but fragile &mdash; removing a key node may disconnect
        the graph.
      </P>

      <SubTitle>Average degree</SubTitle>
      <P>
        Average degree is the mean number of connections per node. In a directed network, this is usually reported
        separately as average in-degree and average out-degree. A high average degree means nodes tend to be well
        connected; a low average degree means most nodes have few ties.
      </P>

      <SubTitle>Reciprocity</SubTitle>
      <P>
        Reciprocity applies only to directed networks. It measures the proportion of mutual connections &mdash; for every
        edge from node A to node B, does an edge also exist from B to A? A reciprocity of 1.0 means all relationships are
        mutual. A reciprocity near 0 means most connections are one-directional.
      </P>
      <P>
        In social networks, high reciprocity often indicates <B>friendship</B> or close collaboration, while low
        reciprocity may indicate <B>hierarchical or influence-based</B> relationships (e.g. follower/following on social
        media).
      </P>

      <SubTitle>Average weight</SubTitle>
      <P>
        In a weighted network, average weight is the mean edge weight across all connections. This provides context for
        interpreting centrality scores: a node with high strength in a low-average-weight network is genuinely dominant,
        whereas the same strength in a high-average-weight network may be less remarkable.
      </P>
    </>
  );
}

function CentralityGuide() {
  return (
    <>
      <SectionTitle>What is centrality?</SectionTitle>
      <P>
        Centrality measures identify the most <B>important or influential nodes</B> in a network. &ldquo;Important&rdquo;
        can mean different things &mdash; most connected, most reachable, or sitting at the intersection of many paths.
        Different centrality measures capture different notions of importance, so researchers often report several.
      </P>
      <P>
        In social networks, centrality helps answer questions like: Who is the most popular student? Who spreads
        information fastest? Who serves as a bridge between otherwise disconnected groups?
      </P>

      <SubTitle>Degree, In-Degree, and Out-Degree</SubTitle>
      <P>
        Degree is simply the count of connections a node has. In undirected networks, every edge counts once. In
        directed networks, <B>in-degree</B> counts how many nodes point <em>to</em> a given node (incoming links),
        and <B>out-degree</B> counts how many nodes a given node points <em>to</em> (outgoing links).
      </P>
      <P>
        High in-degree nodes are popular &mdash; many others connect to them. High out-degree nodes are active initiators
        of connections. A node with both high in-degree and high out-degree is a central hub.
      </P>

      <SubTitle>In-Strength and Out-Strength</SubTitle>
      <P>
        In weighted networks, <B>strength</B> sums the edge weights rather than just counting edges. A node with three
        strong connections may be more influential than one with ten weak connections. In-Strength and Out-Strength are
        the weighted equivalents of In-Degree and Out-Degree.
      </P>
      <P>
        For example, in a co-authorship network, a researcher who collaborated extensively with many colleagues (high
        total co-authored papers) will have high strength even if their raw degree is similar to peers.
      </P>

      <SubTitle>Betweenness centrality</SubTitle>
      <P>
        Betweenness centrality measures how often a node lies on the <B>shortest path between other pairs of nodes</B>.
        A node with high betweenness is a <B>bridge</B> or <B>broker</B> &mdash; it connects otherwise separate parts
        of the network. Remove such a node and the network may become disconnected or much less efficient.
      </P>
      <P>
        In classrooms, high-betweenness students often bridge social groups. In collaborative networks, high-betweenness
        researchers connect different research communities. Betweenness is especially useful for identifying structural
        brokers who may not be the most popular but are critically positioned.
      </P>

      <SubTitle>Closeness centrality</SubTitle>
      <P>
        Closeness centrality measures how close a node is to all other nodes &mdash; specifically, the inverse of the
        average shortest path distance. A node with <B>high closeness</B> can reach all other nodes quickly, making it
        efficient for spreading information.
      </P>
      <P>
        Nodes with high closeness are well-positioned to disseminate knowledge or coordinate activity. In a classroom
        network, a student with high closeness centrality could spread information to the whole class in fewer steps
        than anyone else.
      </P>

      <SubTitle>Interpreting centrality in context</SubTitle>
      <P>
        No single centrality measure is universally best. Use degree/strength when you care about direct connections,
        betweenness when you care about brokerage and bridges, and closeness when you care about reach and efficiency.
        Compare measures across nodes &mdash; a node that ranks highly on all three is likely a true structural hub.
      </P>
    </>
  );
}

function CommunitiesGuide() {
  return (
    <>
      <SectionTitle>What are communities?</SectionTitle>
      <P>
        Communities (or clusters) are groups of nodes that are <B>more densely connected to each other than to the rest
        of the network</B>. In social networks, communities often correspond to friend groups, research clusters,
        workgroups, or shared interests &mdash; real social structures that emerge from the pattern of connections.
      </P>
      <P>
        Community detection is <B>unsupervised</B>: the algorithm discovers groupings from the network structure alone,
        without any prior knowledge of who belongs together. The result is a partition of nodes into groups that
        maximises internal connectivity relative to external connectivity.
      </P>

      <SubTitle>Label propagation</SubTitle>
      <P>
        Label propagation is a fast, intuitive algorithm. Each node starts with its own unique label. In each iteration,
        every node adopts the most common label among its neighbours. When no node changes its label, the process
        converges and nodes sharing the same label form a community.
      </P>
      <P>
        Label propagation is non-deterministic &mdash; running it twice may give different results for networks with
        ambiguous community structure. It works well for large networks and does not require specifying the number of
        communities in advance.
      </P>

      <SubTitle>Modularity-based algorithms</SubTitle>
      <P>
        Modularity measures the density of links inside communities compared to links between communities. Algorithms
        like <B>Modularity Greedy</B> and <B>Girvan-Newman</B> optimise this score. Modularity Greedy builds communities
        bottom-up by merging nodes that increase modularity most. Girvan-Newman works top-down by progressively removing
        the edge with the highest betweenness centrality.
      </P>

      <SubTitle>Walktrap</SubTitle>
      <P>
        Walktrap uses <B>random walks</B>: the idea is that a random walk on a graph tends to get &ldquo;trapped&rdquo;
        in densely connected regions. By analysing where random walks of length 3&ndash;5 tend to stay, the algorithm
        identifies communities as regions where walks rarely escape.
      </P>

      <SubTitle>Spectral clustering</SubTitle>
      <P>
        Spectral methods use the <B>eigenvalues of the graph Laplacian</B> to project nodes into a lower-dimensional
        space where clustering becomes easier. This approach can detect communities with complex shapes that modularity
        methods may miss, but it is computationally heavier for large graphs.
      </P>

      <SubTitle>Interpreting results</SubTitle>
      <P>
        Look for communities that correspond to meaningful social groupings. Do the nodes in each community share
        attributes (same role, same department, same study group)? Are there nodes that sit between communities with
        many cross-community connections? Those bridge nodes often have high betweenness centrality &mdash; comparing
        centrality and community results together is a powerful interpretive strategy.
      </P>
    </>
  );
}

function AdjacencyGuide() {
  return (
    <>
      <SectionTitle>What is the adjacency matrix?</SectionTitle>
      <P>
        The adjacency matrix is the <B>mathematical foundation</B> of any network. It is a square matrix where rows and
        columns both represent nodes. Each cell [<em>i</em>,&nbsp;<em>j</em>] contains the weight of the connection
        from node <em>i</em> to node <em>j</em>. A zero means no direct connection; a positive value means a connection
        exists with that weight.
      </P>
      <P>
        Every network can be represented as an adjacency matrix, and every adjacency matrix defines a network. The two
        representations are equivalent &mdash; the matrix is just more convenient for mathematics, while the graph is
        more convenient for human interpretation.
      </P>

      <SubTitle>Directed vs. undirected</SubTitle>
      <P>
        In an <B>undirected network</B>, the matrix is symmetric: cell [<em>i</em>,<em>j</em>] equals cell
        [<em>j</em>,<em>i</em>]. Friendships and co-authorships are often undirected &mdash; if Alice is connected
        to Bob, Bob is connected to Alice.
      </P>
      <P>
        In a <B>directed network</B>, the matrix may be asymmetric: Alice can follow Bob without Bob following Alice.
        The row represents the <em>source</em> and the column represents the <em>destination</em>. In directed networks
        you can read rows as &ldquo;who does this person reach out to?&rdquo; and columns as &ldquo;who reaches out
        to this person?&rdquo;
      </P>

      <SubTitle>Reading the heatmap</SubTitle>
      <P>
        The heatmap visualises the matrix with colour intensity proportional to edge weight &mdash; darker cells
        indicate stronger connections. Patterns to look for:
      </P>
      <ul className="list-disc list-inside text-sm space-y-1.5 mb-3">
        <li><B>Dark rows</B> &mdash; a node that connects strongly to many others (high out-strength)</li>
        <li><B>Dark columns</B> &mdash; a node that receives many strong connections (high in-strength)</li>
        <li><B>Block structure</B> &mdash; clusters of cells that are dark together, suggesting communities</li>
        <li><B>Diagonal values</B> &mdash; self-connections (if any), indicating that a node is connected to itself</li>
        <li><B>Sparse rows/columns</B> &mdash; peripheral nodes with few or weak connections</li>
      </ul>

      <SubTitle>Matrix operations and network analysis</SubTitle>
      <P>
        The adjacency matrix enables powerful mathematical analyses. Raising the matrix to a power reveals indirect paths:
        the [<em>i</em>,<em>j</em>] cell of <em>A</em><sup>2</sup> counts the number of paths of length 2 from node
        <em>i</em> to node <em>j</em>. The eigenvalues of the matrix reveal the largest communities and structural
        features. All centrality measures computed above are derived ultimately from this matrix.
      </P>
      <P>
        Understanding the adjacency matrix helps you appreciate that network visualisation is just one way to see the
        same underlying data structure &mdash; the matrix contains the full, lossless representation of the network.
      </P>
    </>
  );
}
