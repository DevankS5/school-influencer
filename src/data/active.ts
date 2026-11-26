import * as real from "./india-school-ecosystem-real-v1";
import * as synthetic from "./india-school-ecosystem-v1";

/** DATASET_VERSION picks the corpus; the real public-source dataset is the default. */
export const ACTIVE = process.env.DATASET_VERSION === synthetic.DATASET_META.version ? synthetic : real;
