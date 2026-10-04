//! `gen adventure`: one list of puzzles per size, in the order the
//! Adventure's steps take them. The small sizes draw from every puzzle built from
//! L1's question kinds that has one solution the engine solves; 3×3, L1's own
//! size, comes from the daily generator with L1's recipe.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::{AtomicUsize, Ordering};

use rayon::iter::{IntoParallelIterator, IntoParallelRefIterator, ParallelIterator};

use refpuzzle::check_form::check_form;
use refpuzzle::construct::{DEFAULT_MAX_REGENERATIONS, generate};
use refpuzzle::recipes::RECIPES;
use refpuzzle::render::{OptionLabelKind, option_label_kind};
use refpuzzle::rng::Rng;
use refpuzzle::serialize::puzzle_to_compact_value;
use refpuzzle::solve_brute;
use refpuzzle::solve_deduce::{EngineConfig, NoSteps, VERIFY_ITERS_PER_QUESTION, run_engine};
use refpuzzle::stats::Stats;
use refpuzzle::types::*;

/// A puzzle size, and the step where the path first offers it.
struct Size {
    questions: usize,
    options: usize,
    joins: usize,
}

impl Size {
    /// The size's name in the corpus file, options × questions as the grid is wide
    /// and tall: `3x2` is 2 questions of 3 options.
    fn key(&self) -> String {
        format!("{}x{}", self.options, self.questions)
    }

    /// L1's own size, which the daily generator supplies.
    fn is_first_level(&self) -> bool {
        let first = &RECIPES[0];
        (self.questions, self.options) == (first.question_count, first.option_count)
    }
}

/// Every size, in the order the path offers them.
const SIZES: [Size; 4] = [
    Size {
        questions: 2,
        options: 2,
        joins: 1,
    },
    Size {
        questions: 3,
        options: 2,
        joins: 30,
    },
    Size {
        questions: 2,
        options: 3,
        joins: 60,
    },
    Size {
        questions: 3,
        options: 3,
        joins: 100,
    },
];

/// The last step each list covers; past it, each list starts over.
const LAST_STEP: usize = 576;

/// Seed for the draw; each size draws from its own, `SEED` plus its index.
const SEED: u32 = 1;

/// One question type with its option values.
#[derive(Clone, Copy)]
struct Question {
    question_type: QuestionType,
    options: [OptionValue; 5],
}

struct Candidate {
    questions: Vec<Question>,
    /// Shared by the puzzles that differ only by relabeling letters or mirroring
    /// question order.
    twin_key: String,
}

/// How many puzzles survive each filter.
#[derive(Default)]
struct Tally {
    puzzles: AtomicUsize,
    no_repeats: AtomicUsize,
    unique: AtomicUsize,
    solved: AtomicUsize,
}

pub fn gen_adventure(output: &str) {
    let lists: Vec<(String, Vec<FlatPuzzle>)> = SIZES
        .iter()
        .enumerate()
        .map(|(index, size)| {
            let count = LAST_STEP + 1 - size.joins;
            let puzzles = if size.is_first_level() {
                generated(count)
            } else {
                let mut rng = Rng::new(SEED + index as u32);
                let pool = candidates(size.questions, size.options);
                drawn(&pool, size.options, count, &mut rng)
            };
            (size.key(), puzzles)
        })
        .collect();

    let out = format_lists(&lists);
    if output == "-" {
        print!("{out}");
    } else {
        std::fs::write(output, out).expect("failed to write output file");
    }
}

/// `count` puzzles in random order. Every twin class gives one puzzle before any
/// gives a second, and no twins sit side by side; a pool smaller than `count`
/// repeats.
fn drawn(pool: &[Candidate], oc: usize, count: usize, rng: &mut Rng) -> Vec<FlatPuzzle> {
    let mut by_twin: BTreeMap<&str, Vec<&Candidate>> = BTreeMap::new();
    for candidate in pool {
        by_twin
            .entry(&candidate.twin_key)
            .or_default()
            .push(candidate);
    }
    let mut classes: Vec<Vec<&Candidate>> = by_twin.into_values().collect();
    for class in &mut classes {
        rng.shuffle(class);
    }
    let mut order: Vec<&Candidate> = Vec::new();
    for round in 0.. {
        let mut picks: Vec<&Candidate> = classes
            .iter()
            .filter_map(|class| class.get(round).copied())
            .collect();
        if picks.is_empty() {
            break;
        }
        rng.shuffle(&mut picks);
        // A round can open with the twin that closed the last.
        if let Some(last) = order.last()
            && picks[0].twin_key == last.twin_key
        {
            let end = picks.len() - 1;
            picks.swap(0, end);
        }
        order.extend(picks);
    }
    eprintln!(
        "  {} twin classes; {count} drawn{}",
        classes.len(),
        if order.len() < count {
            ", repeating"
        } else {
            ""
        }
    );
    order
        .iter()
        .cycle()
        .take(count)
        .map(|candidate| puzzle(&candidate.questions, oc))
        .collect()
}

/// `count` L1 puzzles from the daily generator, one per twin class.
fn generated(count: usize) -> Vec<FlatPuzzle> {
    let recipe = &RECIPES[0];
    // A margin for the twins dropped below.
    let attempts = count + count / 10;
    let puzzles: Vec<FlatPuzzle> = (0..attempts as u32)
        .into_par_iter()
        .map(|i| {
            let mut rng = Rng::new(SEED.wrapping_add(i).wrapping_mul(7919));
            generate(
                recipe,
                &mut rng,
                DEFAULT_MAX_REGENERATIONS,
                &mut Stats::default(),
                "adventure",
            )
            .unwrap_or_else(|| panic!("no L1 puzzle within the budget (attempt {i})"))
        })
        .collect();
    let mut seen: BTreeSet<String> = BTreeSet::new();
    let distinct: Vec<FlatPuzzle> = puzzles
        .into_iter()
        .filter(|fp| seen.insert(twin_key(&questions_of(fp), fp.option_count)))
        .take(count)
        .collect();
    assert_eq!(
        distinct.len(),
        count,
        "too many twins among the generated L1 puzzles"
    );
    eprintln!(
        "{}x{}: {count} generated",
        recipe.option_count, recipe.question_count
    );
    distinct
}

fn questions_of(fp: &FlatPuzzle) -> Vec<Question> {
    assert!(
        fp.true_stmt_question_types.is_none(),
        "an L1 puzzle with true statements"
    );
    (0..fp.n)
        .map(|qi| Question {
            question_type: fp.question_types[qi],
            options: fp.options[qi],
        })
        .collect()
}

fn candidates(n: usize, oc: usize) -> Vec<Candidate> {
    let questions_by_position: Vec<Vec<Question>> =
        (0..n).map(|qi| questions_at(qi, n, oc)).collect();
    let tally = Tally::default();

    let mut candidates: Vec<Candidate> = questions_by_position[0]
        .par_iter()
        .flat_map_iter(|first| {
            let mut found = Vec::new();
            let mut picked = vec![*first];
            each_puzzle(&questions_by_position, &mut picked, &mut |questions| {
                if let Some(candidate) = assess(questions, oc, &tally) {
                    found.push(candidate);
                }
            });
            found
        })
        .collect();
    // An order independent of how the puzzles were enumerated.
    candidates.sort_by_cached_key(|candidate| compact_json(&puzzle(&candidate.questions, oc)));

    eprintln!(
        "{oc}x{n}: {} puzzles, {} without repeated questions, {} with one solution, {} engine-solved",
        tally.puzzles.load(Ordering::Relaxed),
        tally.no_repeats.load(Ordering::Relaxed),
        tally.unique.load(Ordering::Relaxed),
        tally.solved.load(Ordering::Relaxed),
    );
    candidates
}

/// Every well-formed question for position `qi`: each L1 question type with each
/// ordering of distinct option values.
fn questions_at(qi: usize, n: usize, oc: usize) -> Vec<Question> {
    let pool: Vec<OptionValue> = (0..=n.max(oc) as u8)
        .map(OptionValue::num)
        .chain([OptionValue::NONE])
        .collect();
    let option_orderings: Vec<[OptionValue; 5]> = orderings(&pool, oc)
        .into_iter()
        .map(|ordering| {
            let mut options = [OptionValue::UNUSED; 5];
            options[..oc].copy_from_slice(&ordering);
            options
        })
        .collect();
    let mut questions = Vec::new();
    for &kind in RECIPES[0].allowed {
        for question_type in question_types(kind, n, oc) {
            for &options in &option_orderings {
                let question = Question {
                    question_type,
                    options,
                };
                // Every position holds the same question; only errors at `qi` count.
                let probe = puzzle(&vec![question; n], oc);
                if check_form(&probe).iter().all(|e| e.qi != qi) {
                    questions.push(question);
                }
            }
        }
    }
    questions
}

/// Every parameterization of `kind` on an `n`×`oc` puzzle; `check_form` sorts out
/// which are legal.
fn question_types(kind: QuestionTypeKind, n: usize, oc: usize) -> Vec<QuestionType> {
    use QuestionTypeKind as K;
    let letters = move || (0..oc as u8).map(Answer::from);
    let positions = 0..n as u8;
    match kind {
        K::CountAnswer => letters()
            .map(|answer| QuestionType::CountAnswer { answer })
            .collect(),
        K::FirstWith => letters()
            .map(|answer| QuestionType::FirstWith { answer })
            .collect(),
        K::LastWith => letters()
            .map(|answer| QuestionType::LastWith { answer })
            .collect(),
        K::AnswerOf => positions
            .map(|question_index| QuestionType::AnswerOf { question_index })
            .collect(),
        K::ClosestAfter => positions
            .flat_map(|after_index| {
                letters().map(move |answer| QuestionType::ClosestAfter {
                    after_index,
                    answer,
                })
            })
            .collect(),
        K::ClosestBefore => positions
            .flat_map(|before_index| {
                letters().map(move |answer| QuestionType::ClosestBefore {
                    before_index,
                    answer,
                })
            })
            .collect(),
        K::PrevSame => vec![QuestionType::PrevSame],
        K::NextSame => vec![QuestionType::NextSame],
        other => panic!("{other:?} has no Adventure enumeration"),
    }
}

/// Every ordered pick of `k` distinct items from `pool`, in pool order.
fn orderings<T: Copy>(pool: &[T], k: usize) -> Vec<Vec<T>> {
    if k == 0 {
        return vec![Vec::new()];
    }
    let mut out = Vec::new();
    for (i, &first) in pool.iter().enumerate() {
        let rest: Vec<T> = pool[..i].iter().chain(&pool[i + 1..]).copied().collect();
        for tail in orderings(&rest, k - 1) {
            out.push([vec![first], tail].concat());
        }
    }
    out
}

/// Every ordering of the first `oc` letters, as old letter index → new.
fn letter_permutations(oc: usize) -> Vec<Vec<usize>> {
    orderings(&(0..oc).collect::<Vec<_>>(), oc)
}

/// Calls `visit` with every puzzle that extends `picked` by one question per
/// remaining position.
fn each_puzzle(
    questions_by_position: &[Vec<Question>],
    picked: &mut Vec<Question>,
    visit: &mut impl FnMut(&[Question]),
) {
    if picked.len() == questions_by_position.len() {
        visit(picked);
        return;
    }
    for &question in &questions_by_position[picked.len()] {
        picked.push(question);
        each_puzzle(questions_by_position, picked, visit);
        picked.pop();
    }
}

fn puzzle(questions: &[Question], oc: usize) -> FlatPuzzle {
    let n = questions.len();
    let mut question_types = [QuestionType::AnswerIsSelf; MAX_N];
    let mut options = [[OptionValue::UNUSED; 5]; MAX_N];
    for (qi, question) in questions.iter().enumerate() {
        question_types[qi] = question.question_type;
        options[qi] = question.options;
    }
    let (affected_by, global_indices) = FlatPuzzle::build_deps(&question_types, n);
    FlatPuzzle {
        question_types,
        options,
        true_stmt_question_types: None,
        affected_by,
        global_indices,
        n,
        option_count: oc,
        initial_state: State::initial(oc),
    }
}

/// The puzzle's candidate entry, or `None` if it repeats a question type, has
/// other than one solution, or the engine can't solve it.
fn assess(questions: &[Question], oc: usize, tally: &Tally) -> Option<Candidate> {
    tally.puzzles.fetch_add(1, Ordering::Relaxed);
    let repeats = questions.iter().enumerate().any(|(i, question)| {
        questions[..i]
            .iter()
            .any(|earlier| earlier.question_type == question.question_type)
    });
    if repeats {
        return None;
    }
    tally.no_repeats.fetch_add(1, Ordering::Relaxed);

    let fp = puzzle(questions, oc);
    assert!(
        check_form(&fp).is_empty(),
        "an assembled puzzle fails check_form"
    );
    if solve_brute::solve(&fp, 2).len() != 1 {
        return None;
    }
    tally.unique.fetch_add(1, Ordering::Relaxed);

    let outcome = run_engine(
        &fp,
        fp.initial_state,
        EngineConfig::fallback(),
        fp.n * VERIFY_ITERS_PER_QUESTION,
        &mut NoSteps,
    );
    if !outcome.solved || outcome.contradiction.is_some() {
        return None;
    }
    tally.solved.fetch_add(1, Ordering::Relaxed);

    Some(Candidate {
        questions: questions.to_vec(),
        twin_key: twin_key(questions, oc),
    })
}

/// The smallest serialized form over every letter relabeling, with and without
/// mirroring.
fn twin_key(questions: &[Question], oc: usize) -> String {
    letter_permutations(oc)
        .iter()
        .flat_map(|permutation| {
            [false, true].map(|mirror| {
                let twin = transform(questions, oc, permutation, mirror);
                compact_json(&puzzle(&twin, oc))
            })
        })
        .min()
        .unwrap()
}

/// `questions` with letters relabeled by `permutation` and, if `mirror`, question
/// order reversed. Solutions map the same way.
fn transform(
    questions: &[Question],
    oc: usize,
    permutation: &[usize],
    mirror: bool,
) -> Vec<Question> {
    let n = questions.len();
    (0..n)
        .map(|j| {
            let question = questions[if mirror { n - 1 - j } else { j }];
            let mut options = [OptionValue::UNUSED; 5];
            for oi in 0..oc {
                let ov = question.options[oi];
                options[permutation[oi]] = match option_label_kind(&question.question_type, ov) {
                    OptionLabelKind::Letter => {
                        OptionValue::num(permutation[ov.value() as usize] as u8)
                    }
                    OptionLabelKind::Question if mirror => OptionValue::num(flip(ov.value(), n)),
                    _ => ov,
                };
            }
            let relabeled = relabel(question.question_type, permutation);
            Question {
                question_type: if mirror {
                    mirrored(relabeled, n)
                } else {
                    relabeled
                },
                options,
            }
        })
        .collect()
}

/// `question_type` with its letter mapped by `permutation`.
fn relabel(question_type: QuestionType, permutation: &[usize]) -> QuestionType {
    let letter = |a: Answer| Answer::from(permutation[a.idx()] as u8);
    match question_type {
        QuestionType::CountAnswer { answer } => QuestionType::CountAnswer {
            answer: letter(answer),
        },
        QuestionType::FirstWith { answer } => QuestionType::FirstWith {
            answer: letter(answer),
        },
        QuestionType::LastWith { answer } => QuestionType::LastWith {
            answer: letter(answer),
        },
        QuestionType::ClosestAfter {
            after_index,
            answer,
        } => QuestionType::ClosestAfter {
            after_index,
            answer: letter(answer),
        },
        QuestionType::ClosestBefore {
            before_index,
            answer,
        } => QuestionType::ClosestBefore {
            before_index,
            answer: letter(answer),
        },
        QuestionType::AnswerOf { .. } | QuestionType::PrevSame | QuestionType::NextSame => {
            question_type
        }
        other => panic!("{:?} has no Adventure relabeling", other.kind()),
    }
}

/// Question index `i` on an `n`-question puzzle in reverse order.
fn flip(i: u8, n: usize) -> u8 {
    (n - 1) as u8 - i
}

/// `question_type` as it reads on an `n`-question puzzle in reverse order.
fn mirrored(question_type: QuestionType, n: usize) -> QuestionType {
    match question_type {
        QuestionType::AnswerOf { question_index } => QuestionType::AnswerOf {
            question_index: flip(question_index, n),
        },
        QuestionType::FirstWith { answer } => QuestionType::LastWith { answer },
        QuestionType::LastWith { answer } => QuestionType::FirstWith { answer },
        QuestionType::ClosestAfter {
            after_index,
            answer,
        } => QuestionType::ClosestBefore {
            before_index: flip(after_index, n),
            answer,
        },
        QuestionType::ClosestBefore {
            before_index,
            answer,
        } => QuestionType::ClosestAfter {
            after_index: flip(before_index, n),
            answer,
        },
        QuestionType::PrevSame => QuestionType::NextSame,
        QuestionType::NextSame => QuestionType::PrevSame,
        QuestionType::CountAnswer { .. } => question_type,
        other => panic!("{:?} has no Adventure mirror", other.kind()),
    }
}

/// A puzzle in the compact form the lists hold.
fn compact_json(fp: &FlatPuzzle) -> String {
    serde_json::to_string(&puzzle_to_compact_value(fp)).unwrap()
}

/// One list per size, one puzzle per line, for readable diffs.
fn format_lists(lists: &[(String, Vec<FlatPuzzle>)]) -> String {
    let mut out = String::from("{\n");
    for (i, (key, puzzles)) in lists.iter().enumerate() {
        out.push_str(&format!("  \"{key}\": [\n"));
        for (j, fp) in puzzles.iter().enumerate() {
            out.push_str("    ");
            out.push_str(&compact_json(fp));
            out.push_str(if j + 1 < puzzles.len() { ",\n" } else { "\n" });
        }
        out.push_str("  ]");
        out.push_str(if i + 1 < lists.len() { ",\n" } else { "\n" });
    }
    out.push_str("}\n");
    out
}

#[cfg(test)]
mod tests {
    use super::{SIZES, candidates, letter_permutations, puzzle, transform};
    use refpuzzle::solve_brute;
    use refpuzzle::types::Answer;

    /// A twin has exactly one solution: the original's, relabeled and mirrored.
    #[test]
    fn twins_keep_their_solution() {
        for size in SIZES.iter().filter(|size| !size.is_first_level()) {
            let (n, oc) = (size.questions, size.options);
            for candidate in candidates(n, oc) {
                let answers = solve_brute::solve(&puzzle(&candidate.questions, oc), 1)[0];
                for permutation in letter_permutations(oc) {
                    for mirror in [false, true] {
                        let twin = puzzle(
                            &transform(&candidate.questions, oc, &permutation, mirror),
                            oc,
                        );
                        let solutions = solve_brute::solve(&twin, 2);
                        let expected: Vec<Answer> = (0..n)
                            .map(|j| {
                                let answer = answers[if mirror { n - 1 - j } else { j }];
                                Answer::from(permutation[answer.idx()] as u8)
                            })
                            .collect();
                        let context = format!(
                            "{oc}x{n} {} {permutation:?} mirror={mirror}",
                            answers[..n]
                                .iter()
                                .map(|answer| answer.as_char())
                                .collect::<String>()
                        );
                        assert_eq!(solutions.len(), 1, "{context}");
                        assert_eq!(&solutions[0][..n], &expected[..], "{context}");
                    }
                }
            }
        }
    }
}
