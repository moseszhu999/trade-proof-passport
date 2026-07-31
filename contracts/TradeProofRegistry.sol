// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/// @title TradeProofRegistry
/// @notice Anchors deterministic hashes of Trade Proof Passports and Responses.
/// @dev The registry proves that an address anchored a hash at a block time.
///      It does not prove that offchain trade facts are true, authorized, legal,
///      complete, or accepted by any other party.
contract TradeProofRegistry {
    enum ArtifactKind {
        Passport,
        Response
    }

    struct Anchor {
        address issuer;
        uint64 anchoredAt;
        uint64 revokedAt;
        ArtifactKind kind;
        bytes32 subjectDigest;
        bytes32 schemaHash;
        bytes32 supersedesDigest;
        bytes32 successorDigest;
        bytes32 revocationReasonHash;
    }

    mapping(bytes32 digest => Anchor anchor) private anchors;

    error ZeroDigest();
    error ZeroSchemaHash();
    error AlreadyAnchored(bytes32 digest);
    error UnknownArtifact(bytes32 digest);
    error NotIssuer(bytes32 digest, address caller);
    error ArtifactNotCurrent(bytes32 digest);
    error KindMismatch(bytes32 digest);
    error SubjectMismatch(bytes32 digest);
    error CurrentPassportRequired(bytes32 digest);

    event ArtifactAnchored(
        bytes32 indexed digest,
        ArtifactKind indexed kind,
        address indexed issuer,
        bytes32 subjectDigest,
        bytes32 schemaHash,
        bytes32 supersedesDigest,
        uint64 anchoredAt
    );

    event ArtifactRevoked(
        bytes32 indexed digest,
        address indexed issuer,
        bytes32 reasonHash,
        uint64 revokedAt
    );

    /// @notice Anchor a Passport digest.
    /// @param digest Keccak-256 digest of the canonical Passport JSON.
    /// @param schemaHash Keccak-256 digest of the schema or schema identifier.
    /// @param supersedesDigest Optional previous Passport digest from the same issuer.
    function anchorPassport(
        bytes32 digest,
        bytes32 schemaHash,
        bytes32 supersedesDigest
    ) external {
        _anchor(
            digest,
            ArtifactKind.Passport,
            bytes32(0),
            schemaHash,
            supersedesDigest
        );
    }

    /// @notice Anchor a Response digest against a current Passport digest.
    /// @param digest Keccak-256 digest of the canonical Response JSON.
    /// @param passportDigest Digest of the Passport this Response addresses.
    /// @param schemaHash Keccak-256 digest of the response schema or identifier.
    /// @param supersedesDigest Optional previous Response digest from the same issuer.
    function anchorResponse(
        bytes32 digest,
        bytes32 passportDigest,
        bytes32 schemaHash,
        bytes32 supersedesDigest
    ) external {
        Anchor storage passport = anchors[passportDigest];
        if (
            passport.issuer == address(0) ||
            passport.kind != ArtifactKind.Passport ||
            !_isCurrent(passport)
        ) {
            revert CurrentPassportRequired(passportDigest);
        }

        _anchor(
            digest,
            ArtifactKind.Response,
            passportDigest,
            schemaHash,
            supersedesDigest
        );
    }

    /// @notice Revoke a current artifact anchored by the caller.
    /// @param digest Artifact digest to revoke.
    /// @param reasonHash Hash of an offchain revocation reason.
    function revoke(bytes32 digest, bytes32 reasonHash) external {
        Anchor storage anchor = anchors[digest];
        if (anchor.issuer == address(0)) revert UnknownArtifact(digest);
        if (anchor.issuer != msg.sender) revert NotIssuer(digest, msg.sender);
        if (!_isCurrent(anchor)) revert ArtifactNotCurrent(digest);

        uint64 revokedAt = uint64(block.timestamp);
        anchor.revokedAt = revokedAt;
        anchor.revocationReasonHash = reasonHash;

        emit ArtifactRevoked(digest, msg.sender, reasonHash, revokedAt);
    }

    /// @notice Return the complete anchor record for a digest.
    function getAnchor(bytes32 digest) external view returns (Anchor memory) {
        Anchor memory anchor = anchors[digest];
        if (anchor.issuer == address(0)) revert UnknownArtifact(digest);
        return anchor;
    }

    /// @notice Return whether a digest has ever been anchored.
    function exists(bytes32 digest) external view returns (bool) {
        return anchors[digest].issuer != address(0);
    }

    /// @notice Return whether a digest is neither revoked nor superseded.
    function isCurrent(bytes32 digest) external view returns (bool) {
        Anchor storage anchor = anchors[digest];
        return anchor.issuer != address(0) && _isCurrent(anchor);
    }

    function _anchor(
        bytes32 digest,
        ArtifactKind kind,
        bytes32 subjectDigest,
        bytes32 schemaHash,
        bytes32 supersedesDigest
    ) private {
        if (digest == bytes32(0)) revert ZeroDigest();
        if (schemaHash == bytes32(0)) revert ZeroSchemaHash();
        if (anchors[digest].issuer != address(0)) revert AlreadyAnchored(digest);

        if (supersedesDigest != bytes32(0)) {
            Anchor storage predecessor = anchors[supersedesDigest];
            if (predecessor.issuer == address(0)) {
                revert UnknownArtifact(supersedesDigest);
            }
            if (predecessor.issuer != msg.sender) {
                revert NotIssuer(supersedesDigest, msg.sender);
            }
            if (!_isCurrent(predecessor)) {
                revert ArtifactNotCurrent(supersedesDigest);
            }
            if (predecessor.kind != kind) {
                revert KindMismatch(supersedesDigest);
            }
            if (
                kind == ArtifactKind.Response &&
                predecessor.subjectDigest != subjectDigest
            ) {
                revert SubjectMismatch(supersedesDigest);
            }

            predecessor.successorDigest = digest;
        }

        uint64 anchoredAt = uint64(block.timestamp);
        anchors[digest] = Anchor({
            issuer: msg.sender,
            anchoredAt: anchoredAt,
            revokedAt: 0,
            kind: kind,
            subjectDigest: subjectDigest,
            schemaHash: schemaHash,
            supersedesDigest: supersedesDigest,
            successorDigest: bytes32(0),
            revocationReasonHash: bytes32(0)
        });

        emit ArtifactAnchored(
            digest,
            kind,
            msg.sender,
            subjectDigest,
            schemaHash,
            supersedesDigest,
            anchoredAt
        );
    }

    function _isCurrent(Anchor storage anchor) private view returns (bool) {
        return anchor.revokedAt == 0 && anchor.successorDigest == bytes32(0);
    }
}
