import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Fetch miRNA entries by name
 * @param {string} name - miRNA name
 * @param {string} apiKey - optional JWT token
 */
export const fetchMiRNAByName = (name, apiKey) => {
    return axios.get(`${API_BASE_URL}/mirna`, {
        params: { name },
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });
};

/**
 * Fetch gene predictions for a miRNA
 * @param {string} name - miRNA name
 * @param {string} apiKey - optional JWT token
 */
export const fetchPredictions = (name, apiKey) => {
    return axios.get(`${API_BASE_URL}/mirna/predictions`, {
        params: { name },
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });
};

/**
 * Fetch pathways affected by a given gene
 * @param {string} name - gene name
 * @param {string} apiKey - optional JWT token
 */
export const fetchPathwaysByGene = (name, apiKey) => {
    return axios.get(`${API_BASE_URL}/gene/pathways`, {
        params: { name },
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });
};
