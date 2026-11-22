"""Shared domain fixtures: the answer-key import and its analysis (retro item 37)."""

import pytest

from swp.domain.analysis import Analysis
from swp.domain.import_data import ImportData
from tests.domain.answer_key import answer_key_analysis, answer_key_import


@pytest.fixture(scope="module")
def data() -> ImportData:
    return answer_key_import().data


@pytest.fixture(scope="module")
def analysis() -> Analysis:
    return answer_key_analysis()
