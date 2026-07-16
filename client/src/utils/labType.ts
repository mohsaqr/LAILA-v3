/**
 * Lab types are free-form strings on CustomLab (e.g. "python-pandas", "tna").
 * The Python runtime is selected by prefix; everything else runs R.
 */
export const isPythonLab = (labType: string) => labType.startsWith('python');
