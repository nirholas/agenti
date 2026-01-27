/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich.xbt
 *  ID: n1ch-0las-4e49-4348-786274000000
 * ═══════════════════════════════════════════════════════════════
 */

package types

type ResourceServerExtension interface {
	Key() string
	EnrichDeclaration(declaration interface{}, transportContext interface{}) interface{}
}


/* ucm:n1ch98c1f9a1 */